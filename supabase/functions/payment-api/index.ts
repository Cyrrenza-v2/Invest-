import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

function allowedOrigin(origin: string) {
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && u.port === "5173") return true;
    return u.protocol === "https:" && (
      u.hostname === "invest-broker.vercel.app" ||
      (u.hostname.startsWith("invest-broker-") && u.hostname.endsWith(".vercel.app"))
    );
  } catch { return false; }
}
function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", "vary": "Origin" });
  if (allowedOrigin(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function safeIntent(row: Record<string, unknown>) {
  return {
    id: row.id, intent_code: row.intent_code, provider: row.provider, intent_type: row.intent_type,
    amount: row.amount, currency: row.currency, asset_symbol: row.asset_symbol, network: row.network,
    receiving_address: row.receiving_address, transaction_hash: row.transaction_hash,
    status: row.status, confirmations: row.confirmations, required_confirmations: row.required_confirmations,
    provider_verified: row.provider_verified, credited_at: row.credited_at, expires_at: row.expires_at,
    created_at: row.created_at, confirmed_at: row.confirmed_at
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, {});
  if (!["GET", "POST"].includes(req.method)) return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigin(origin)) return json(req, { error: "Origin not allowed" }, 403);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(req, { error: "Authentication required" }, 401);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json(req, { error: "Invalid or expired session" }, 401);
  if (user.app_metadata?.role === "admin") return json(req, { error: "Use the Admin API for privileged accounts" }, 403);

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("approval_status,account_status").eq("id", user.id).maybeSingle();
  if (profileError) return json(req, { error: "Unable to verify account status" }, 500);
  if (!profile || profile.approval_status !== "approved" || profile.account_status !== "active") {
    return json(req, { error: "An approved, active customer account is required" }, 403);
  }

  const route = new URL(req.url).pathname.split("/").filter(Boolean).slice(-1)[0] ?? "";
  try {
    if (req.method === "GET" && route === "catalog") {
      const { data, error } = await db.from("payment_provider_registry")
        .select("provider,display_name,integration_status,test_mode_only,checkout_enabled,wallet_credit_enabled,notes")
        .order("display_name");
      if (error) throw error;
      return json(req, { test_mode: true, providers: data ?? [], note: "No provider checkout or wallet credit is enabled." });
    }
    if (req.method === "GET" && route === "intents") {
      const { data, error } = await db.from("payment_intents")
        .select("id,intent_code,provider,intent_type,amount,currency,asset_symbol,network,receiving_address,transaction_hash,status,confirmations,required_confirmations,provider_verified,credited_at,expires_at,created_at,confirmed_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json(req, { test_mode: true, data: data ?? [] });
    }
    if (req.method !== "POST" || route !== "intents") return json(req, { error: "Route not found" }, 404);

    const payload = await req.json().catch(() => null);
    const provider = payload?.provider;
    const intentType = payload?.intent_type;
    const amount = Number(payload?.amount);
    const currency = typeof payload?.currency === "string" ? payload.currency.trim().toUpperCase() : "";
    const idempotencyKey = typeof payload?.idempotency_key === "string" ? payload.idempotency_key.trim() : "";
    const assetSymbol = typeof payload?.asset_symbol === "string" ? payload.asset_symbol.trim().toUpperCase() : null;
    const network = typeof payload?.network === "string" ? payload.network.trim() : null;

    if (!["paycanvas", "payu", "crypto_wallet"].includes(provider)) return json(req, { error: "Unsupported payment provider" }, 400);
    if (!["fiat_checkout", "crypto_wallet"].includes(intentType)) return json(req, { error: "Unsupported payment intent type" }, 400);
    if ((provider === "crypto_wallet") !== (intentType === "crypto_wallet")) return json(req, { error: "Provider and intent type do not match" }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) return json(req, { error: "Amount must be positive and within the test limit" }, 400);
    if (!/^[A-Z0-9]{2,12}$/.test(currency)) return json(req, { error: "Provide a valid currency or asset symbol" }, 400);
    if (idempotencyKey.length < 12 || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
      return json(req, { error: "Provide an idempotency key of 12–128 safe characters" }, 400);
    }
    if (intentType === "crypto_wallet" && (!assetSymbol || !/^[A-Z0-9]{2,12}$/.test(assetSymbol) || !network || network.length > 80)) {
      return json(req, { error: "Crypto test intents require an asset symbol and network" }, 400);
    }

    const { data: existing, error: existingError } = await db.from("payment_intents")
      .select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.user_id !== user.id) return json(req, { error: "Idempotency key conflict" }, 409);
      return json(req, { test_mode: true, data: safeIntent(existing), reused: true, credited: false }, 200);
    }

    const { data: providerConfig, error: configError } = await db.from("payment_provider_registry")
      .select("integration_status,checkout_enabled,wallet_credit_enabled")
      .eq("provider", provider).single();
    if (configError) throw configError;

    // Safe scaffold only: no external checkout, chain lookup, webhook processing, or ledger credit.
    // Keep provider secrets in Supabase Edge Function secrets when the real adapter is verified.
    const { data: created, error: createError } = await db.from("payment_intents").insert({
      user_id: user.id, provider, intent_type: intentType, amount, currency,
      asset_symbol: intentType === "crypto_wallet" ? assetSymbol : null,
      network: intentType === "crypto_wallet" ? network : null,
      idempotency_key: idempotencyKey, status: "pending",
      metadata: { mode: "test", integration_status: providerConfig.integration_status }
    }).select("*").single();
    if (createError) {
      if (createError.code === "23505") return json(req, { error: "Duplicate transaction request; retry with the original idempotency key" }, 409);
      throw createError;
    }
    return json(req, {
      test_mode: true, data: safeIntent(created), credited: false,
      provider_ready: providerConfig.checkout_enabled && providerConfig.integration_status === "test_verified",
      next_step: "provider_setup_required",
      message: "Test intent recorded only. No external payment was initiated, no crypto address was issued, and no wallet balance was credited."
    }, 201);
  } catch (error) {
    console.error("payment-api error", error);
    return json(req, { error: "Unable to process payment request" }, 500);
  }
});
