import test from "node:test";
import assert from "node:assert/strict";
import { getProjectedReturn, summarizeProjectedReturns } from "./projected-returns.js";

test("calculates a fixed-rate estimate without calling it earned profit", () => {
  const result = getProjectedReturn({
    principal: 1000,
    currency: "USD",
    status: "active",
    investment_plans: { return_method: "fixed", return_rate: 12, currency: "USD" }
  });
  assert.deepEqual(result, {
    currency: "USD",
    ratePercent: 12,
    projectedProfit: 120,
    projectedTotal: 1120,
    method: "fixed",
    basis: "published fixed rate for the full plan term",
    status: "projection_only"
  });
});

test("does not guess simple, compound, variable or missing plan rules", () => {
  for (const method of ["simple", "compound", "variable", undefined]) {
    assert.equal(getProjectedReturn({
      principal: 1000,
      investment_plans: { return_method: method, return_rate: 12 }
    }), null);
  }
  assert.equal(getProjectedReturn({ principal: 1000 }), null);
});

test("rejects invalid principal and rate values", () => {
  assert.equal(getProjectedReturn({
    principal: -10,
    investment_plans: { return_method: "fixed", return_rate: 12 }
  }), null);
  assert.equal(getProjectedReturn({
    principal: 1000,
    investment_plans: { return_method: "fixed", return_rate: "invalid" }
  }), null);
});

test("summarizes estimates separately and avoids adding mixed currencies", () => {
  const summary = summarizeProjectedReturns([
    { id: "a", principal: 100, currency: "USD", status: "active", investment_plans: { return_method: "fixed", return_rate: 10, currency: "USD" } },
    { id: "b", principal: 200, currency: "USD", status: "active", investment_plans: { return_method: "simple", return_rate: 10, currency: "USD" } }
  ]);
  assert.equal(summary.items.length, 1);
  assert.equal(summary.totalProjectedProfit, 10);
  assert.equal(summary.currency, "USD");
  assert.equal(summary.unsupportedCount, 1);

  const mixed = summarizeProjectedReturns([
    { principal: 100, currency: "USD", status: "active", investment_plans: { return_method: "fixed", return_rate: 10, currency: "USD" } },
    { principal: 100, currency: "NGN", status: "active", investment_plans: { return_method: "fixed", return_rate: 10, currency: "NGN" } }
  ]);
  assert.equal(mixed.totalProjectedProfit, null);
  assert.equal(mixed.mixedCurrencies, true);
});

test("does not estimate returns when both investment and plan currency are missing", () => {
  assert.equal(getProjectedReturn({
    principal: 1000,
    status: "active",
    investment_plans: { return_method: "fixed", return_rate: 12, currency: null }
  }), null);
});

test("uses plan currency only when investment currency is absent", () => {
  const result = getProjectedReturn({
    principal: 1000,
    status: "active",
    investment_plans: { return_method: "fixed", return_rate: 12, currency: "USD" }
  });
  assert.equal(result.currency, "USD");
});
