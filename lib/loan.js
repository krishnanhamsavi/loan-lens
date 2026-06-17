// lib/loan.js
// THE DETERMINISTIC CORE. No AI touches this file.
// Every dollar figure in the product is computed here and nowhere else.

export function amortize({ amount, downPayment = 0, apr, years }) {
  const principal = Math.max(0, amount - (downPayment || 0));
  const n = Math.round(years * 12);
  const r = apr / 100 / 12;
  let monthly;
  if (r === 0) monthly = n > 0 ? principal / n : 0;
  else
    monthly =
      (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPaid = monthly * n;
  const totalInterest = totalPaid - principal;
  return {
    principal,
    n,
    monthly,
    totalPaid,
    totalInterest,
    interestShare: totalPaid > 0 ? totalInterest / totalPaid : 0,
    paybackPerDollar: principal > 0 ? totalPaid / principal : 0,
  };
}

// Alternate terms so the monthly-vs-total trade-off is unavoidable.
export function termScenarios({ amount, downPayment = 0, apr, years }) {
  const base = amortize({ amount, downPayment, apr, years });
  const candidates = [2, 3, 4, 5, 6, 7].filter((y) => y !== Math.round(years));
  return candidates
    .map((y) => {
      const s = amortize({ amount, downPayment, apr, years: y });
      return {
        years: y,
        monthly: s.monthly,
        totalInterest: s.totalInterest,
        dMonthly: s.monthly - base.monthly,
        dInterest: s.totalInterest - base.totalInterest,
      };
    })
    .sort((a, b) => a.years - b.years);
}

// Rate-reset SCENARIOS for variable loans — labelled as scenarios, never a forecast.
export function rateScenarios({ amount, downPayment = 0, apr, years }) {
  const base = amortize({ amount, downPayment, apr, years });
  return [1, 2].map((bump) => {
    const s = amortize({ amount, downPayment, apr: apr + bump, years });
    return {
      bump,
      apr: apr + bump,
      monthly: s.monthly,
      dMonthly: s.monthly - base.monthly,
    };
  });
}

// Build the FACTS object the model is allowed to reference. The model never
// recomputes — it only explains these already-true numbers.
export function buildFacts({ type, inputs, variable, extra }) {
  const core = amortize(inputs);
  const terms = termScenarios(inputs);
  const rates = variable ? rateScenarios(inputs) : null;
  return {
    loan_type: type,
    price: inputs.amount,
    down_payment: inputs.downPayment,
    amount_financed: Math.round(core.principal),
    apr_percent: inputs.apr,
    term_years: inputs.years,
    monthly_payment: Math.round(core.monthly),
    total_paid_back: Math.round(core.totalPaid),
    total_interest: Math.round(core.totalInterest),
    interest_as_share_of_total: Math.round(core.interestShare * 100) + "%",
    payback_per_dollar_borrowed: core.paybackPerDollar.toFixed(2),
    is_variable_rate: variable,
    term_alternatives: terms.map((t) => ({
      years: t.years,
      monthly: Math.round(t.monthly),
      total_interest: Math.round(t.totalInterest),
      interest_change_vs_chosen: Math.round(t.dInterest),
    })),
    rate_reset_scenarios: rates
      ? rates.map((x) => ({
          if_rate_rises_points: x.bump,
          new_monthly: Math.round(x.monthly),
          monthly_increase: Math.round(x.dMonthly),
        }))
      : null,
    extra_terms_user_pasted: extra || "(none provided)",
  };
}
