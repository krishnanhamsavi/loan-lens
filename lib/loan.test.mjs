// Tests for the deterministic core. The product's promise is "the numbers come
// from code," so this file locks that code in place. Uses Node's built-in test
// runner (no dependencies): run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amortize,
  termScenarios,
  rateScenarios,
  buildFacts,
  homeCosts,
  rateComparison,
  underwaterWindow,
  compareOffers,
} from "./loan.js";

// ----- amortize: the formula everything else depends on -----

test("amortize: 200k at 6% over 30 years gives the textbook $1,199.10/mo", () => {
  const a = amortize({ amount: 200000, downPayment: 0, apr: 6, years: 30 });
  assert.equal(Number(a.monthly.toFixed(2)), 1199.1);
  assert.equal(a.n, 360);
  assert.equal(a.principal, 200000);
});

test("amortize: a 0% loan has zero interest and even payments", () => {
  const a = amortize({ amount: 12000, downPayment: 0, apr: 0, years: 2 });
  assert.equal(a.monthly, 500);
  assert.equal(a.totalInterest, 0);
  assert.equal(a.totalPaid, 12000);
});

test("amortize: down payment reduces principal, and never goes negative", () => {
  assert.equal(amortize({ amount: 30000, downPayment: 5000, apr: 5, years: 5 }).principal, 25000);
  // Down payment larger than price clamps to zero, no negative loan.
  const over = amortize({ amount: 10000, downPayment: 15000, apr: 5, years: 5 });
  assert.equal(over.principal, 0);
  assert.equal(over.monthly, 0);
  assert.equal(over.totalInterest, 0);
});

// ----- term scenarios: the monthly vs total trade-off -----

test("termScenarios: a shorter term costs more monthly but less interest", () => {
  const base = { amount: 32000, downPayment: 3000, apr: 8.9, years: 6 };
  const rows = termScenarios(base);
  // The chosen term is excluded from the alternatives.
  assert.ok(rows.every((r) => r.years !== 6));
  const shorter = rows.find((r) => r.years === 4);
  assert.ok(shorter.dMonthly > 0, "shorter term raises the monthly payment");
  assert.ok(shorter.dInterest < 0, "shorter term lowers total interest");
});

test("rateScenarios: a rate bump only raises the monthly payment", () => {
  const rows = rateScenarios({ amount: 32000, downPayment: 3000, apr: 8.9, years: 6 });
  assert.equal(rows.length, 2);
  assert.ok(rows[0].dMonthly > 0);
  assert.ok(rows[1].dMonthly > rows[0].dMonthly);
});

// ----- home costs: PITI, defaults, PMI -----

test("homeCosts: under 20% down adds PMI that ends, and uses labelled defaults", () => {
  const hc = homeCosts({ amount: 400000, downPayment: 32000, apr: 6.5, years: 30 });
  assert.equal(hc.has_pmi, true);
  assert.ok(hc.pmi_monthly > 0);
  assert.ok(hc.pmi_ends_about_year > 0);
  // Blank tax and insurance fall back to estimates, and are flagged as such.
  assert.equal(hc.property_tax_is_estimate, true);
  assert.equal(hc.home_insurance_is_estimate, true);
  // True monthly is the sum of its parts.
  assert.equal(
    hc.true_monthly_piti,
    hc.principal_interest_monthly + hc.property_tax_monthly + hc.home_insurance_monthly + hc.pmi_monthly
  );
});

test("homeCosts: 20%+ down has no PMI, and provided values are not estimates", () => {
  const hc = homeCosts({ amount: 400000, downPayment: 100000, apr: 6.5, years: 30, propertyTax: 6000, homeInsurance: 1800 });
  assert.equal(hc.has_pmi, false);
  assert.equal(hc.pmi_monthly, 0);
  assert.equal(hc.pmi_ends_about_year, null);
  assert.equal(hc.property_tax_is_estimate, false);
  assert.equal(hc.home_insurance_is_estimate, false);
  assert.equal(hc.property_tax_monthly, 500); // 6000 / 12
});

// ----- rate comparison: one source of truth -----

test("rateComparison: places the APR in the dated range, or returns null", () => {
  assert.equal(rateComparison("car", 8.9).position, "on the higher end");
  assert.equal(rateComparison("car", 4).position, "below the typical range");
  assert.equal(rateComparison("home", 7).position, "in the middle");
  assert.equal(rateComparison("car", 8.9).worth_shopping, true);
  assert.equal(rateComparison("car", 5.5).worth_shopping, false);
  // No reference for an unknown type, so we say nothing.
  assert.equal(rateComparison("boat", 8), null);
});

// ----- underwater window: crossover month and LTV -----

test("underwaterWindow: the default car loan dips underwater then recovers", () => {
  const uw = underwaterWindow({ amount: 32000, downPayment: 3000, apr: 8.9, years: 6 });
  assert.equal(uw.financed_percent, 91);
  assert.equal(uw.ever_underwater, true);
  assert.ok(Number.isInteger(uw.crossover_month) && uw.crossover_month > 0);
  assert.equal(uw.full_term_underwater, false);
});

test("underwaterWindow: a large down payment never goes underwater", () => {
  const uw = underwaterWindow({ amount: 32000, downPayment: 12000, apr: 5, years: 4 });
  assert.equal(uw.ever_underwater, false);
  assert.equal(uw.crossover_month, null);
  assert.equal(uw.full_term_underwater, false);
});

// ----- buildFacts: car vs home wiring -----

test("buildFacts: car gets an underwater estimate and no home costs", () => {
  const f = buildFacts({ type: "car", inputs: { amount: 32000, downPayment: 3000, apr: 8.9, years: 6 }, variable: false, extra: "" });
  assert.ok(f.underwater);
  assert.equal(f.home_costs, null);
  assert.ok(f.rate_comparison);
});

test("buildFacts: home gets cost breakdown and no underwater estimate", () => {
  const f = buildFacts({ type: "home", inputs: { amount: 400000, downPayment: 32000, apr: 6.5, years: 30 }, variable: false, extra: "" });
  assert.ok(f.home_costs);
  assert.equal(f.underwater, null);
});

// ----- compareOffers: the code does the ranking -----

test("compareOffers: ranks cheapest total and lowest monthly, and flags the trade-off", () => {
  const c = compareOffers([
    { type: "car", label: "Dealer", inputs: { amount: 32000, downPayment: 3000, apr: 8.9, years: 6 } },
    { type: "car", label: "Credit union", inputs: { amount: 32000, downPayment: 3000, apr: 6.4, years: 5 } },
  ]);
  // The longer 6yr loan has the lower monthly but the higher total.
  assert.equal(c.cheapest_by_total_cost.label, "Credit union");
  assert.equal(c.cheapest_by_monthly_payment.label, "Dealer");
  assert.ok(c.total_cost_gap > 0);
  assert.equal(c.lowest_monthly_costs_more_overall, true);
});

test("compareOffers: falls back to Offer A, B labels when none given", () => {
  const c = compareOffers([
    { type: "car", inputs: { amount: 1000, downPayment: 0, apr: 5, years: 1 } },
    { type: "home", inputs: { amount: 2000, downPayment: 0, apr: 5, years: 1 } },
  ]);
  assert.equal(c.offers[0].label, "Offer A");
  assert.equal(c.offers[1].label, "Offer B");
});
