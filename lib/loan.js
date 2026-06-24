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

// A STATIC, hand-maintained reference of typical APR ranges. We deliberately do
// not fetch live data. Update these by hand now and then and bump `as_of`. The
// ranges are rough, span typical credit tiers, and are estimates the user
// should sanity check, not a quote.
export const RATE_REFERENCE = {
  as_of: "June 2026",
  car: { low: 5, high: 9 },
  home: { low: 6, high: 7.5 },
};

// State factually where the user's APR sits in the typical range. The CODE
// decides the position; the model only repeats it. If there is no reliable
// reference for the loan type, returns null so we say nothing rather than guess.
export function rateComparison(type, apr) {
  const ref = RATE_REFERENCE[type];
  if (!ref || !(apr > 0)) return null;
  const { low, high } = ref;
  const span = high - low;
  let position;
  if (apr < low) position = "below the typical range";
  else if (span > 0 && apr <= low + span / 3) position = "on the lower end";
  else if (span > 0 && apr <= low + (2 * span) / 3) position = "in the middle";
  else if (apr <= high) position = "on the higher end";
  else position = "above the typical range";
  return {
    as_of: RATE_REFERENCE.as_of,
    typical_low: low,
    typical_high: high,
    your_apr: apr,
    position,
    // Only suggest shopping the rate when it is at the high end or above.
    worth_shopping: apr > low + (2 * span) / 3,
  };
}

// The true monthly cost of a home loan (PITI): principal and interest, plus
// property tax, home insurance, and PMI. Tax and insurance default to estimates
// when the user leaves them blank. PMI applies only while the down payment is
// under 20% of the price, and runs until the balance amortizes to 80% of price.
// All of this is computed here, in code; the model never recomputes it.
export function homeCosts({ amount, downPayment = 0, apr, years, propertyTax, homeInsurance }) {
  const core = amortize({ amount, downPayment, apr, years });
  const loan = core.principal;
  const r = apr / 100 / 12;
  const n = core.n;
  const M = core.monthly;

  const taxProvided = Number(propertyTax) > 0;
  const insProvided = Number(homeInsurance) > 0;
  const taxAnnual = taxProvided ? Number(propertyTax) : amount * 0.011; // ~1.1% of price
  const insAnnual = insProvided ? Number(homeInsurance) : 1500; // ~$1,500/yr

  const downShare = amount > 0 ? downPayment / amount : 1;
  const hasPmi = downShare < 0.2;
  const pmiAnnual = hasPmi ? loan * 0.007 : 0; // ~0.7% of the loan a year

  // PMI runs until the balance amortizes down to 80% of the home price.
  let pmiEndsMonth = null;
  if (hasPmi) {
    const target = amount * 0.8;
    for (let k = 0; k <= n; k++) {
      const f = r === 0 ? 1 : Math.pow(1 + r, k);
      const bal = r === 0 ? Math.max(0, loan - M * k) : Math.max(0, loan * f - (M * (f - 1)) / r);
      if (bal <= target) {
        pmiEndsMonth = k;
        break;
      }
    }
  }

  const taxMonthly = taxAnnual / 12;
  const insMonthly = insAnnual / 12;
  const pmiMonthly = pmiAnnual / 12;

  return {
    principal_interest_monthly: Math.round(M),
    property_tax_monthly: Math.round(taxMonthly),
    home_insurance_monthly: Math.round(insMonthly),
    pmi_monthly: Math.round(pmiMonthly),
    true_monthly_piti: Math.round(M + taxMonthly + insMonthly + pmiMonthly),
    has_pmi: hasPmi,
    pmi_ends_about_year: pmiEndsMonth != null ? Math.max(1, Math.round(pmiEndsMonth / 12)) : null,
    property_tax_is_estimate: !taxProvided,
    home_insurance_is_estimate: !insProvided,
  };
}

// Named, tunable depreciation curve for cars. Front-loaded on purpose: a new
// car loses value the moment you drive it off, so a purely linear year-one
// curve understates early negative equity. These are rough assumptions, labelled
// as such in the UI. Tune here in one place.
export const DEPRECIATION = {
  drive_off_drop: 0.1, // ~10% lost the moment you drive off
  first_year_total: 0.2, // ~20% lost by the end of year one
  per_year_after: 0.15, // ~15% of remaining value each year after
};

// Estimate the negative equity window for a car loan: the months you owe more
// than the car is worth, and the crossover month when the balance finally drops
// below resale value. Also reports loan-to-value at signing. The code finds the
// window; the model never asserts it. A rough estimate, not a prediction.
export function underwaterWindow({ amount, downPayment = 0, apr, years }) {
  const core = amortize({ amount, downPayment, apr, years });
  const loan = core.principal;
  const r = apr / 100 / 12;
  const n = core.n;
  const M = core.monthly;
  const price = amount;

  const balanceAt = (k) => {
    if (r === 0) return Math.max(0, loan - M * k);
    const f = Math.pow(1 + r, k);
    return Math.max(0, loan * f - (M * (f - 1)) / r);
  };
  // Value curve: an immediate drive-off drop, the rest of year one spread across
  // the first 12 months, then a fixed share of remaining value each year after.
  const valueAt = (k) => {
    const t = k / 12;
    const startYearOne = 1 - DEPRECIATION.drive_off_drop; // 0.90
    const endYearOne = 1 - DEPRECIATION.first_year_total; // 0.80
    if (t <= 1) return price * (startYearOne + (endYearOne - startYearOne) * t);
    return price * endYearOne * Math.pow(1 - DEPRECIATION.per_year_after, t - 1);
  };

  let enter = null;
  let crossover = null;
  for (let k = 0; k <= n; k++) {
    const uw = balanceAt(k) > valueAt(k);
    if (uw && enter === null) enter = k;
    if (enter !== null && !uw) {
      crossover = k;
      break;
    }
  }
  const ever = enter !== null;
  return {
    financed_percent: price > 0 ? Math.round((loan / price) * 100) : 0,
    ever_underwater: ever,
    // Month the balance first falls below resale value, or null if it never does.
    crossover_month: crossover,
    full_term_underwater: ever && crossover === null,
  };
}

// Build the FACTS object the model is allowed to reference. The model never
// recomputes — it only explains these already-true numbers.
export function buildFacts({ type, inputs, variable, extra }) {
  const core = amortize(inputs);
  const terms = termScenarios(inputs);
  const rates = variable ? rateScenarios(inputs) : null;

  // Context flags are decided HERE, in code, not by the model. They let the
  // brief react to this specific offer. The model only explains the flags that
  // are true; it never sets them and never works out its own thresholds. The
  // cutoffs are rough heuristics, easy to tune, and deliberately conservative
  // so we flag only what the numbers actually support.
  const price = inputs.amount || 0;
  const downShare = price > 0 ? (inputs.downPayment || 0) / price : 1;
  const highAprCutoff = type === "home" ? 8 : 11;
  const contextFlags = {
    long_car_term: type === "car" && inputs.years >= 6, // underwater risk
    low_down_payment: downShare < 0.1, // under 10% down
    high_apr_for_type: inputs.apr >= highAprCutoff, // high for this loan type
  };

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
    context_flags: contextFlags,
    // True monthly cost (taxes, insurance, PMI) for home loans only.
    home_costs: type === "home" ? homeCosts(inputs) : null,
    // Where the APR sits versus the dated reference, or null if no reference.
    rate_comparison: rateComparison(type, inputs.apr),
    // Underwater window for car loans only.
    underwater: type === "car" ? underwaterWindow(inputs) : null,
  };
}

// Compare 2 or 3 offers. Reuses amortize() so the comparison math is the same
// single source of truth as everywhere else. THE CODE DOES THE RANKING here:
// it decides which offer costs the least, by total cost and by monthly payment.
// The model is never asked to compute or rank; it only explains these facts.
// "Cheapest" is an objective dollar fact, not advice about which loan to take.
export function compareOffers(offers) {
  const computed = offers.map((o, i) => {
    const core = amortize(o.inputs);
    return {
      label: (o.label && o.label.trim()) || `Offer ${String.fromCharCode(65 + i)}`,
      loan_type: o.type,
      price: o.inputs.amount,
      down_payment: o.inputs.downPayment,
      amount_financed: Math.round(core.principal),
      apr_percent: o.inputs.apr,
      term_years: o.inputs.years,
      monthly_payment: Math.round(core.monthly),
      total_paid_back: Math.round(core.totalPaid),
      total_interest: Math.round(core.totalInterest),
      is_variable_rate: !!o.variable,
      extra_terms_user_pasted: (o.extra && o.extra.trim()) || "(none provided)",
      // True monthly cost for home comparisons; null for cars.
      true_monthly_piti: o.type === "home" ? homeCosts(o.inputs).true_monthly_piti : null,
      // Where each offer's rate sits versus the dated reference.
      rate_position: rateComparison(o.type, o.inputs.apr),
    };
  });

  const byTotal = computed
    .map((c, i) => ({ i, v: c.total_paid_back }))
    .sort((a, b) => a.v - b.v);
  const byMonthly = computed
    .map((c, i) => ({ i, v: c.monthly_payment }))
    .sort((a, b) => a.v - b.v);

  const cheapestTotal = byTotal[0].i;
  const dearestTotal = byTotal[byTotal.length - 1].i;
  const cheapestMonthly = byMonthly[0].i;

  return {
    offers: computed,
    cheapest_by_total_cost: {
      index: cheapestTotal,
      label: computed[cheapestTotal].label,
      total_paid_back: computed[cheapestTotal].total_paid_back,
    },
    cheapest_by_monthly_payment: {
      index: cheapestMonthly,
      label: computed[cheapestMonthly].label,
      monthly_payment: computed[cheapestMonthly].monthly_payment,
    },
    // The dollar spread between the priciest and cheapest total cost.
    total_cost_gap:
      computed[dearestTotal].total_paid_back -
      computed[cheapestTotal].total_paid_back,
    // True when the offer with the lowest monthly is NOT the cheapest overall:
    // the central trade-off the product exists to surface.
    lowest_monthly_costs_more_overall: cheapestMonthly !== cheapestTotal,
  };
}
