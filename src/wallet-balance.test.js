import test from "node:test";
import assert from "node:assert/strict";
import { getReconciledAvailableBalance, displayAvailableBalance } from "./wallet-balance.js";

test("does not infer an available balance from a wallet without reconciliation", () => {
  assert.equal(getReconciledAvailableBalance({ id: "wallet-1" }), null);
  assert.equal(getReconciledAvailableBalance(null), null);
});

test("requires explicit server reconciliation and a finite amount", () => {
  assert.equal(getReconciledAvailableBalance({ balance_reconciled: true, available_balance: "not-a-number" }), null);
  assert.equal(getReconciledAvailableBalance({ balance_reconciled: false, available_balance: 250 }), null);
});

test("accepts an explicitly reconciled zero balance", () => {
  assert.equal(getReconciledAvailableBalance({ balance_reconciled: true, available_balance: 0 }), 0);
});

test("shows a clear status instead of fabricating a zero balance", () => {
  assert.equal(displayAvailableBalance(null), "Pending reconciliation");
  assert.match(displayAvailableBalance(1234.5), /1,234/);
});

test("formats customer available balances as US dollars by default", () => {
  assert.match(displayAvailableBalance(1234.5), /^\$1,234\.5/);
});
