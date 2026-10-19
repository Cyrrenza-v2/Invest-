import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SELF, abortAllDurableObjects } from "cloudflare:test";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const MALFORMED_USER_ID = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY_USER_ID = "44444444-4444-4444-8444-444444444444";
const CONFLICT_USER_ID = "55555555-5555-4555-8555-555555555555";
const CONCURRENT_USER_ID = "66666666-6666-4666-8666-666666666666";
const RESTART_USER_ID = "77777777-7777-4777-8777-777777777777";
const VALIDATION_USER_ID = "88888888-8888-4888-8888-888888888888";

function headersFor(userId: string) {
  return {
    authorization: `Bearer unit-test-only-token-${userId}`,
    "content-type": "application/json",
  };
}

function operation(accountId: string, idempotencyKey: string, overrides: Record<string, unknown> = {}) {
  return {
    accountId,
    idempotencyKey,
    operationType: "deposit",
    amountMinor: 250_000,
    currency: "USD",
    ...overrides,
  };
}

async function postOperation(body: unknown, requestHeaders?: Record<string, string>) {
  const accountId = body && typeof body === "object" && "accountId" in body
    ? String((body as { accountId: unknown }).accountId)
    : TEST_USER_ID;
  return SELF.fetch("https://invest-broker.test/api/v1/operations", {
    method: "POST",
    headers: requestHeaders ?? headersFor(accountId),
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") {
      const requestHeaders = new Headers(init?.headers);
      const authorization = requestHeaders.get("authorization") ?? "";
      const match = authorization.match(/^Bearer unit-test-only-token-([0-9a-f-]+)$/i);
      if (!match || requestHeaders.get("apikey") !== "test-publishable-key") {
        return new Response(JSON.stringify({ message: "Invalid token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: match[1] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Invest Broker Worker API", () => {
  it("exposes a public health endpoint", async () => {
    const response = await SELF.fetch("https://invest-broker.test/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "invest-broker-api",
      mode: "test",
    });
  });

  it("rejects requests without a bearer token", async () => {
    const response = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${TEST_USER_ID}`,
    );
    expect(response.status).toBe(401);
  });

  it("rejects an invalid or expired Supabase token", async () => {
    const response = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${TEST_USER_ID}`,
      { headers: { authorization: "Bearer wrong-token" } },
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("rejects a caller trying to access another user's account", async () => {
    const response = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${OTHER_USER_ID}`,
      { headers: headersFor(TEST_USER_ID) },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "account_forbidden" });
  });

  it("rejects an operation targeting another user's account before writing", async () => {
    const response = await postOperation(
      operation(OTHER_USER_ID, "foreign-ref-001"),
      headersFor(TEST_USER_ID),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "account_forbidden" });
  });

  it("rejects malformed operation payloads before writing an event", async () => {
    const response = await postOperation({ accountId: MALFORMED_USER_ID, operationType: "deposit" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_operation" });
    const summary = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${MALFORMED_USER_ID}`,
      { headers: headersFor(MALFORMED_USER_ID) },
    );
    expect((await summary.json() as any).totalOperations).toBe(0);
  });

  it("records an operation once and returns the same record for a duplicate", async () => {
    const body = operation(IDEMPOTENCY_USER_ID, "deposit-ref-0001");
    const first = await postOperation(body);
    const second = await postOperation(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await first.json() as any).duplicate).toBe(false);
    expect((await second.json() as any).duplicate).toBe(true);
    const summary = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${IDEMPOTENCY_USER_ID}`,
      { headers: headersFor(IDEMPOTENCY_USER_ID) },
    );
    expect((await summary.json() as any).totalOperations).toBe(1);
  });

  it("rejects reuse of an idempotency key with different operation data", async () => {
    const first = await postOperation(operation(CONFLICT_USER_ID, "operation-ref-0001"));
    const second = await postOperation(operation(CONFLICT_USER_ID, "operation-ref-0001", { amountMinor: 999_999 }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("serializes concurrent duplicate requests without double-recording", async () => {
    const body = operation(CONCURRENT_USER_ID, "concurrent-ref-001");
    const responses = await Promise.all(Array.from({ length: 20 }, () => postOperation(body)));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 200)).toHaveLength(19);
    const summary = await SELF.fetch(
      `https://invest-broker.test/api/v1/summary?accountId=${CONCURRENT_USER_ID}`,
      { headers: headersFor(CONCURRENT_USER_ID) },
    );
    expect((await summary.json() as any).totalOperations).toBe(1);
  });

  it("preserves SQLite records after a forced Durable Object restart", async () => {
    const body = operation(RESTART_USER_ID, "restart-ref-001");
    const created = await postOperation(body);
    expect(created.status).toBe(201);
    await abortAllDurableObjects();
    const read = await SELF.fetch(
      `https://invest-broker.test/api/v1/operations/restart-ref-001?accountId=${RESTART_USER_ID}`,
      { headers: headersFor(RESTART_USER_ID) },
    );
    expect(read.status).toBe(200);
    const result = await read.json() as any;
    expect(result.operation.idempotency_key).toBe("restart-ref-001");
    expect(result.operation.mode).toBe("test");
  });

  it("validates amount, USD currency, and idempotency key", async () => {
    const badAmount = await postOperation(operation(VALIDATION_USER_ID, "validation-ref-001", { amountMinor: -1 }));
    const badCurrency = await postOperation(operation(VALIDATION_USER_ID, "validation-ref-002", { currency: "NGN" }));
    const badKey = await postOperation(operation(VALIDATION_USER_ID, "short"));
    expect(badAmount.status).toBe(400);
    expect(badCurrency.status).toBe(400);
    expect(badKey.status).toBe(400);
  });
});
