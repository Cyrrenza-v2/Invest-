import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const adminDb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function isAllowedOrigin(origin: string) {
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && u.port === "5173") return true;
    return u.protocol === "https:" && (u.hostname === "invest-broker.vercel.app" || (u.hostname.startsWith("invest-broker-") && u.hostname.endsWith(".vercel.app")));
  } catch { return false; }
}
function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", "vary": "Origin" });
  if (isAllowedOrigin(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, {});
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (origin && !isAllowedOrigin(origin)) return json(req, { error: "Origin not allowed" }, 403);
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(req, { error: "Sign in to finish administrator setup" }, 401);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json(req, { error: "Invalid or expired session" }, 401);
  if ((user.email ?? "").toLowerCase() !== "udofiaasianubong583@gmail.com") return json(req, { error: "Only the designated administrator email can complete setup" }, 403);
  if (!user.email_confirmed_at) return json(req, { error: "Confirm the designated email first, then sign in again to finish setup" }, 403);
  const { data, error } = await adminDb.rpc("bootstrap_primary_admin", { p_user_id: user.id });
  if (error) {
    const message = error.message || "Administrator setup failed";
    const status = message.includes("already been assigned") ? 409 : message.includes("Confirm the designated email") || message.includes("Only the designated") ? 403 : 500;
    console.error("admin-bootstrap rejected", { code: error.code, message });
    return json(req, { error: message }, status);
  }
  return json(req, { data });
});
