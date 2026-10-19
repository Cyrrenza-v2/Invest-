import { describe, expect, it } from "vitest";
import { getBitgetMode, isLiveExecutionEnabled, maySignOrBroadcast, validateTransactionIntent } from "./bitget-wallet";

const intent = {
  chain: "sol",
  fromAddress: "FromAddress123",
  toAddress: "ToAddress1234",
  amount: "0.25",
  asset: "SOL",
  idempotencyKey: "test-intent-0001",
  userConfirmed: true,
};

describe("Bitget Wallet safety boundary", () => {
  it("defaults to disabled", () => {
    expect(getBitgetMode({})).toBe("disabled");
  });

  it("rejects unknown modes safely", () => {
    expect(getBitgetMode({ mode: "live" })).toBe("disabled");
  });

  it("accepts a well-formed, explicitly confirmed transaction intent", () => {
    expect(validateTransactionIntent(intent)).toBe(true);
  });

  it("rejects an intent without explicit confirmation", () => {
    expect(validateTransactionIntent({ ...intent, userConfirmed: false })).toBe(false);
  });

  it("rejects zero, negative, scientific notation, and malformed amounts", () => {
    for (const amount of ["0", "-1", "1e5", "NaN", "0."]) {
      expect(validateTransactionIntent({ ...intent, amount })).toBe(false);
    }
  });

  it("rejects malformed idempotency keys and missing addresses", () => {
    expect(validateTransactionIntent({ ...intent, idempotencyKey: "x" })).toBe(false);
    expect(validateTransactionIntent({ ...intent, toAddress: "" })).toBe(false);
  });

  it("never permits signing or live execution in this release", () => {
    expect(maySignOrBroadcast({ mode: "test", allowSigning: "true" }, intent)).toBe(false);
    expect(isLiveExecutionEnabled({ mode: "test", allowSigning: "true" })).toBe(false);
  });
});
