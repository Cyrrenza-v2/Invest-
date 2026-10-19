import { DurableObject } from "cloudflare:workers";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function validAccountId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function validOperation(value) {
  if (!value || typeof value !== "object") return false;
  return (
    validAccountId(value.accountId) &&
    typeof value.idempotencyKey === "string" &&
    /^[A-Za-z0-9._:-]{8,128}$/.test(value.idempotencyKey) &&
    ["deposit", "withdrawal", "investment", "return", "adjustment"].includes(value.operationType) &&
    Number.isSafeInteger(value.amountMinor) &&
    value.amountMinor > 0 &&
    value.currency === "USD"
  );
}

async function authenticate(request, env) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return json({ error: "service_not_configured" }, 503);
  }

  let response;
  try {
    const supabaseUrl = env.SUPABASE_URL.endsWith("/")
      ? env.SUPABASE_URL.slice(0, -1)
      : env.SUPABASE_URL;
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
    });
  } catch {
    return json({ error: "identity_service_unavailable" }, 503);
  }

  if (!response.ok) return json({ error: "unauthorized" }, 401);
  const user = await response.json().catch(() => null);
  if (!user || typeof user.id !== "string" || !validAccountId(user.id)) {
    return json({ error: "unauthorized" }, 401);
  }
  return { id: user.id };
}

function sameOperation(existing, input) {
  return (
    existing.operation_type === input.operationType &&
    existing.amount_minor === input.amountMinor &&
    existing.currency === input.currency
  );
}

export class LedgerDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        idempotency_key TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL CHECK (length(currency) = 3),
        status TEXT NOT NULL CHECK (status = 'recorded'),
        mode TEXT NOT NULL CHECK (mode = 'test'),
        created_at TEXT NOT NULL
      )
    `);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/operations") {
      let input;
      try {
        input = await request.json();
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      if (!validOperation(input)) return json({ error: "invalid_operation" }, 400);

      const existing = this.ctx.storage.sql
        .exec(
          "SELECT idempotency_key, operation_type, amount_minor, currency, status, mode, created_at FROM operations WHERE idempotency_key = ?",
          input.idempotencyKey,
        )
        .toArray()[0];

      if (existing) {
        if (!sameOperation(existing, input)) {
          return json({ error: "idempotency_conflict", message: "This key was already used for a different operation." }, 409);
        }
        return json({ operation: existing, duplicate: true }, 200);
      }

      const record = {
        idempotency_key: input.idempotencyKey,
        operation_type: input.operationType,
        amount_minor: input.amountMinor,
        currency: input.currency,
        status: "recorded",
        mode: "test",
        created_at: new Date().toISOString(),
      };

      this.ctx.storage.sql.exec(
        "INSERT INTO operations (idempotency_key, operation_type, amount_minor, currency, status, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        record.idempotency_key,
        record.operation_type,
        record.amount_minor,
        record.currency,
        record.status,
        record.mode,
        record.created_at,
      );
      return json({ operation: record, duplicate: false }, 201);
    }

    if (request.method === "GET" && url.pathname === "/operations") {
      const rows = this.ctx.storage.sql
        .exec(
          "SELECT idempotency_key, operation_type, amount_minor, currency, status, mode, created_at FROM operations ORDER BY created_at DESC LIMIT 100",
        )
        .toArray();
      return json({ operations: rows, mode: "test" });
    }

    if (request.method === "GET" && url.pathname.startsWith("/operations/")) {
      const key = decodeURIComponent(url.pathname.slice("/operations/".length));
      const record = this.ctx.storage.sql
        .exec(
          "SELECT idempotency_key, operation_type, amount_minor, currency, status, mode, created_at FROM operations WHERE idempotency_key = ?",
          key,
        )
        .toArray()[0];
      return record ? json({ operation: record }) : json({ error: "not_found" }, 404);
    }

    if (request.method === "GET" && url.pathname === "/summary") {
      const rows = this.ctx.storage.sql
        .exec("SELECT operation_type, COUNT(*) AS count FROM operations GROUP BY operation_type ORDER BY operation_type")
        .toArray();
      const total = this.ctx.storage.sql.exec("SELECT COUNT(*) AS count FROM operations").toArray()[0]?.count ?? 0;
      return json({ totalOperations: total, byType: rows, mode: "test" });
    }

    return json({ error: "not_found" }, 404);
  }
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "invest-broker-api", mode: "test" });
    }
    if (!url.pathname.startsWith("/api/v1/")) return json({ error: "not_found" }, 404);

    const identity = await authenticate(request, env);
    if (identity instanceof Response) return identity;

    if (request.method === "POST" && url.pathname === "/api/v1/operations") {
      let input;
      try {
        input = await request.clone().json();
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      if (!input || typeof input !== "object" || !validAccountId(input.accountId)) {
        return json({ error: "invalid_account_id" }, 400);
      }
      if (input.accountId !== identity.id) return json({ error: "account_forbidden" }, 403);
      const stub = env.LEDGER.getByName(input.accountId);
      return stub.fetch(new Request("https://ledger.internal/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }));
    }

    if ((request.method === "GET" && url.pathname === "/api/v1/operations") ||
        (request.method === "GET" && url.pathname === "/api/v1/summary")) {
      const accountId = url.searchParams.get("accountId");
      if (!validAccountId(accountId)) return json({ error: "invalid_account_id" }, 400);
      if (accountId !== identity.id) return json({ error: "account_forbidden" }, 403);
      const stub = env.LEDGER.getByName(accountId);
      const targetPath = url.pathname.endsWith("/summary") ? "/summary" : "/operations";
      return stub.fetch(new Request(`https://ledger.internal${targetPath}`));
    }

    const operationMatch = url.pathname.match(/^\/api\/v1\/operations\/([^/]+)$/);
    if (request.method === "GET" && operationMatch) {
      const accountId = url.searchParams.get("accountId");
      if (!validAccountId(accountId)) return json({ error: "invalid_account_id" }, 400);
      if (accountId !== identity.id) return json({ error: "account_forbidden" }, 403);
      const stub = env.LEDGER.getByName(accountId);
      return stub.fetch(new Request(`https://ledger.internal/operations/${encodeURIComponent(operationMatch[1])}`));
    }

    return json({ error: "not_found" }, 404);
  },
};

export default worker;
