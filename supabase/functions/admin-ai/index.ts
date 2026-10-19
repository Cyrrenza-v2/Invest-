import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function allowedOrigin(origin: string) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && u.port === "5173") return true;
    return u.protocol === "https:" &&
      (u.hostname === "invest-broker.vercel.app" ||
       u.hostname === "admin-invest-broker.vercel.app" ||
       (u.hostname.startsWith("invest-broker-") && u.hostname.endsWith(".vercel.app")) ||
       (u.hostname.startsWith("admin-invest-broker-") && u.hostname.endsWith(".vercel.app")));
  } catch { return false; }
}
function respond(req: Request, body: unknown, status = 200) {
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
    "vary": "Origin",
    "x-content-type-options": "nosniff"
  });
  const origin = req.headers.get("origin") ?? "";
  if (allowedOrigin(origin) && origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}
async function count(table: string, column = "id", filter?: (q: any) => any) {
  let q = db.from(table).select(column, { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: value, error } = await q;
  if (error) throw error;
  return value ?? 0;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return respond(req, {});
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigin(origin)) return respond(req, { error: "Origin not allowed" }, 403);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return respond(req, { error: "Authentication required" }, 401);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return respond(req, { error: "Invalid or expired session" }, 401);
  if (user.app_metadata?.role !== "admin") return respond(req, { error: "Administrator permission required" }, 403);
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || claimsData?.claims?.aal !== "aal2") return respond(req, { error: "Verified MFA (AAL2) is required" }, 403);

  const { data: control, error: controlError } = await db.from("platform_control")
    .select("primary_admin_user_id").eq("singleton", true).maybeSingle();
  if (controlError) return respond(req, { error: "Unable to verify administrator configuration" }, 500);
  if (!control?.primary_admin_user_id) return respond(req, { error: "Primary administrator has not been assigned" }, 503);
  if (control.primary_admin_user_id !== user.id) return respond(req, { error: "This account is not the assigned primary administrator" }, 403);

  const payload = await req.json().catch(() => null);
  const question = typeof payload?.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 1200) return respond(req, { error: "Question must contain between 1 and 1200 characters" }, 400);
  if (!openAiKey) return respond(req, {
    error: "AI is not configured yet. Add OPENAI_API_KEY to Supabase Edge Function secrets, then retry.",
    code: "AI_NOT_CONFIGURED"
  }, 503);

  try {
    const [users, activeInvestments, pendingDeposits, pendingWithdrawals, openComplianceCases] = await Promise.all([
      count("profiles", "id", (q: any) => q.neq("id", control.primary_admin_user_id)),
      count("investments", "id", (q: any) => q.in("status", ["active", "matured"])),
      count("deposits", "id", (q: any) => q.in("status", ["pending", "processing"])),
      count("withdrawals", "id", (q: any) => q.in("status", ["pending", "under_review"])),
      count("compliance_cases", "id", (q: any) => q.in("status", ["open", "in_review", "on_hold"]))
    ]);
    const snapshot = { users, activeOrMaturedInvestments: activeInvestments, pendingDeposits, pendingWithdrawals, openComplianceCases };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "authorization": "Bearer " + openAiKey, "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        instructions: "You are Invest-broker's read-only Admin Manager Assistant. Use only the aggregate operational snapshot provided. Clearly distinguish facts from suggestions, note that counts are point-in-time, and ask for clarification when needed. Never claim to have performed an action. Never instruct or attempt to approve/reject accounts, move funds, execute payments, alter investments, or bypass MFA/audit controls. Do not request credentials, API keys, card data, or identity documents. If asked for individual customer data or data not in the snapshot, say it is not available in this initial AI release. Keep answers concise and operational.",
        input: "Administrator question:\n" + question + "\n\nVerified aggregate snapshot (counts only; no personal customer records):\n" + JSON.stringify(snapshot),
        max_output_tokens: 500
      })
    });
    if (!response.ok) {
      console.error("OpenAI response failed", { status: response.status });
      return respond(req, { error: "AI provider request failed. Check the server-side AI key and provider status." }, 502);
    }
    const result = await response.json();
    const answer = typeof result.output_text === "string" ? result.output_text.trim() :
      (result.output ?? []).flatMap((item: any) => item.content ?? [])
        .filter((item: any) => item.type === "output_text")
        .map((item: any) => item.text ?? "").join("\n").trim();
    if (!answer) return respond(req, { error: "AI returned an empty answer. Please retry." }, 502);
    return respond(req, { data: { answer, snapshot, readOnly: true, model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini" } });
  } catch (error) {
    console.error("admin-ai failed", error instanceof Error ? error.message : "unknown error");
    return respond(req, { error: "Unable to prepare the admin AI response. Verify the operational tables and retry." }, 500);
  }
});