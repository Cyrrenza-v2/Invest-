export function getProjectedReturn(investment) {
  const principal = Number(investment?.principal);
  const plan = investment?.investment_plans;
  const rate = Number(plan?.return_rate);

  // A fixed rate is treated as a percentage of principal for the full plan term.
  // Other methods need explicit compounding/period rules and are intentionally not guessed.
  if (!Number.isFinite(principal) || principal < 0) return null;
  if (!plan || plan.return_method !== "fixed") return null;
  if (plan.return_rate === null || plan.return_rate === undefined || plan.return_rate === "") return null;
  if (!Number.isFinite(rate) || rate < 0) return null;

  return {
    currency: investment.currency || plan.currency || null,
    ratePercent: rate,
    projectedProfit: Math.round((principal * rate / 100 + Number.EPSILON) * 100) / 100,
    projectedTotal: Math.round((principal + principal * rate / 100 + Number.EPSILON) * 100) / 100,
    method: "fixed",
    basis: "published fixed rate for the full plan term",
    status: "projection_only"
  };
}

export function summarizeProjectedReturns(investments = []) {
  const eligible = investments
    .filter(item => ["active", "matured", "under_review"].includes(item?.status))
    .map(item => ({ investment: item, projection: getProjectedReturn(item) }));
  const calculated = eligible.filter(item => item.projection);
  const unsupportedCount = eligible.length - calculated.length;
  const currencies = new Set(calculated.map(item => item.projection.currency).filter(Boolean));
  const allCurrenciesKnown = calculated.every(item => Boolean(item.projection.currency));
  const singleCurrency = allCurrenciesKnown && currencies.size === 1 ? [...currencies][0] : null;

  return {
    items: calculated,
    unsupportedCount,
    totalProjectedProfit: singleCurrency
      ? Math.round((calculated.reduce((sum, item) => sum + item.projection.projectedProfit, 0) + Number.EPSILON) * 100) / 100
      : null,
    currency: singleCurrency,
    mixedCurrencies: currencies.size > 1,
    missingCurrency: calculated.some(item => !item.projection.currency)
  };
}
