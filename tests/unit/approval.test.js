import test from "node:test";
import assert from "node:assert/strict";
import { getAccountAccess } from "../../src/approval.js";

test("approved and active accounts can enter the customer area", () => {
  assert.equal(getAccountAccess({ approval_status: "approved", account_status: "active" }).allowed, true);
});
test("pending applications remain blocked", () => {
  const result = getAccountAccess({ approval_status: "pending", account_status: "pending_kyc" });
  assert.equal(result.allowed, false);
  assert.equal(result.state, "pending");
});
test("approved but inactive accounts remain blocked", () => {
  const result = getAccountAccess({ approval_status: "approved", account_status: "restricted" });
  assert.equal(result.allowed, false);
  assert.equal(result.state, "inactive");
});
test("rejected applications remain blocked", () => {
  assert.equal(getAccountAccess({ approval_status: "rejected", account_status: "restricted" }).state, "rejected");
});
test("missing profile does not grant access", () => {
  assert.equal(getAccountAccess(null).allowed, false);
});
