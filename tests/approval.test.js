import test from "node:test";
import assert from "node:assert/strict";
import { approvalAccessMessage, isApprovedAccount } from "../src/approval.js";

test("new registrations cannot access the customer dashboard before admin approval", () => {
  const profile = { approval_status: "pending", account_status: "pending_kyc" };
  assert.equal(isApprovedAccount(profile), false);
  assert.equal(approvalAccessMessage(profile), "pending");
});

test("approved and active customers can access the dashboard", () => {
  const profile = { approval_status: "approved", account_status: "active" };
  assert.equal(isApprovedAccount(profile), true);
  assert.equal(approvalAccessMessage(profile), "approved");
});

test("rejected or restricted accounts remain blocked", () => {
  assert.equal(isApprovedAccount({ approval_status: "rejected", account_status: "restricted" }), false);
  assert.equal(approvalAccessMessage({ approval_status: "rejected", account_status: "restricted" }), "rejected");
  assert.equal(isApprovedAccount({ approval_status: "approved", account_status: "restricted" }), false);
  assert.equal(approvalAccessMessage({ approval_status: "approved", account_status: "restricted" }), "restricted");
});
