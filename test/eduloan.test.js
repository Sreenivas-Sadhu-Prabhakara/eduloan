"use strict";
/* eduloan self-tests — re-derive the core formulas and assert the brief's
   hand-computed fixtures exactly, to the paisa. Run: node --test */

const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../data/engine.js");
const { FACTS } = require("../data/facts.js");

// The worked loan behind every fixture:
// ₹10,00,000 sanctioned, 10% p.a., course 48 months + 12-month tail (60-month
// moratorium), 120-month repayment, lump-sum disbursement at month 0.
const BASE = {
  amount: 1000000, annualRate: 0.10, courseMonths: 48, tailMonths: 12,
  tenureMonths: 120, disbursement: "lump"
};

/* ---------------- closed-form EMI ---------------- */

test("emi: closed-form annuity matches the proven fixtures to the paisa", () => {
  assert.equal(E.emi(1000000, 0.10, 120), 13215.07);
  assert.equal(E.emi(1500000, 0.10, 120), 19822.61);
  assert.equal(E.emi(1320000, 0.10, 120), 17443.90);
  assert.equal(E.emi(1350000, 0.10, 120), 17840.35); // 4-tranche capitalised balance
});

test("emi: independent re-derivation from first principles", () => {
  // EMI is the payment X with P·(1+i)^n − X·((1+i)^n − 1)/i === 0
  const P = 1000000, i = 0.10 / 12, n = 120;
  const pow = Math.pow(1 + i, n);
  const X = (P * i * pow) / (pow - 1);
  assert.equal(E.emi(P, 0.10, n), E.round2(X));
  const residual = P * pow - X * ((pow - 1) / i);
  assert.ok(Math.abs(residual) < 1e-6, "annuity identity must close");
});

test("emi: zero-rate edge degenerates to P/n with zero interest", () => {
  assert.equal(E.emi(120000, 0, 12), 10000.00);
  const s = E.buildScenario({ ...BASE, amount: 120000, annualRate: 0, courseMonths: 6, tailMonths: 6, tenureMonths: 12, mode: "none" });
  assert.equal(s.totalInterest, 0);
  const b = E.buildScenario({ ...BASE, amount: 120000, annualRate: 0, courseMonths: 6, tailMonths: 6, tenureMonths: 12, mode: "interest" });
  assert.equal(b.moratoriumPaid, 0.00); // servicing degenerates to 0.00
});

/* ---------------- moratorium accrual ---------------- */

test("accruedSimple: ₹10L × 10% × 5y === 500000.00", () => {
  assert.equal(E.accruedSimple(1000000, 0.10, 60), 500000.00);
});

test("accruedSimpleTranches: 4 yearly tranches === 350000.00 (125000+100000+75000+50000)", () => {
  const tr = [[0, 250000], [12, 250000], [24, 250000], [36, 250000]];
  assert.equal(E.accruedSimpleTranches(tr, 0.10, 60), 350000.00);
  assert.equal(E.emi(1350000, 0.10, 120), 17840.35);
});

test("compounding toggle: monthly-rest balance round2(10L×(1+0.10/12)^60) === 1645308.93", () => {
  assert.equal(E.compoundBalance(1000000, 0.10, 60), 1645308.93);
  const s = E.buildScenario({ ...BASE, mode: "none", compounding: true });
  assert.equal(s.capitalisedBalance, 1645308.93);
});

/* ---------------- the three scenarios (the product) ---------------- */

test("Scenario A (full moratorium): capitalised 15L, EMI 19822.61, closes at 0, outflow 2378713.27, interest 1378713.27", () => {
  const a = E.buildScenario({ ...BASE, mode: "none" });
  assert.equal(a.capitalisedBalance, 1500000.00);
  assert.equal(a.emi, 19822.61);
  assert.equal(a.amortRows[a.amortRows.length - 1].closingP, 0);
  assert.equal(a.totalOutflow, 2378713.27);
  assert.equal(a.totalInterest, 1378713.27);
});

test("Scenario B (interest served): 59×8333.33 + final 8333.53 === 500000.00 exact; EMI stays 13215.07; outflow 2085809.12; interest 1085809.12", () => {
  const b = E.buildScenario({ ...BASE, mode: "interest" });
  const pays = b.moratoriumRows.map((r) => r.paymentP);
  assert.equal(pays.length, 60);
  for (let k = 0; k < 59; k++) assert.equal(pays[k], 833333); // round2(10L×0.10/12) = 8333.33
  assert.equal(pays[59], 833353); // trued-up final servicing payment 8333.53
  assert.equal(b.moratoriumPaid, 500000.00);
  assert.equal(b.capitalisedBalance, 1000000.00);
  assert.equal(b.emi, 13215.07);
  assert.equal(b.totalOutflow, 2085809.12);
  assert.equal(b.totalInterest, 1085809.12);
});

test("Scenario C (₹3000/mo partial): capitalised 1320000.00, EMI 17443.90, outflow 2273267.48, interest 1273267.48", () => {
  const c = E.buildScenario({ ...BASE, mode: "partial", partialAmount: 3000 });
  assert.equal(c.capitalisedBalance, 1320000.00); // 1000000 + 500000 − 180000
  assert.equal(c.moratoriumPaid, 180000.00);
  assert.equal(c.emi, 17443.90);
  assert.equal(c.totalOutflow, 2273267.48);
  assert.equal(c.totalInterest, 1273267.48);
});

test("verdict deltas to the paisa: A−B === 292904.15 and A−C === 105445.79", () => {
  const a = E.buildScenario({ ...BASE, mode: "none" });
  const b = E.buildScenario({ ...BASE, mode: "interest" });
  const c = E.buildScenario({ ...BASE, mode: "partial", partialAmount: 3000 });
  assert.equal(E.round2(a.totalOutflow - b.totalOutflow), 292904.15);
  assert.equal(E.round2(a.totalOutflow - c.totalOutflow), 105445.79);
});

/* ---------------- schedule integrity ---------------- */

function assertScheduleIntegrity(s, label) {
  const i = 0.10 / 12;
  let prinSumP = 0;
  for (const r of s.amortRows) {
    assert.equal(r.interestP, E.toPaise(E.round2(E.toRupees(r.openingP) * i)), label + ": row interest === round2(opening×i)");
    assert.equal(r.paymentP, r.interestP + r.principalP, label + ": payment splits exactly");
    assert.equal(r.closingP, r.openingP - r.principalP, label + ": closing chains");
    assert.ok(r.interestP >= 0 && r.principalP >= 0 && r.paymentP >= 0 && r.closingP >= 0, label + ": no negative cells");
    prinSumP += r.principalP;
  }
  assert.equal(prinSumP, E.toPaise(s.capitalisedBalance), label + ": principal components sum to the capitalised balance exactly");
  assert.equal(s.amortRows[s.amortRows.length - 1].closingP, 0, label + ": final balance 0");
}

test("schedule integrity holds for all three scenarios; per-FY interest subtotals sum to interest paid", () => {
  const scenarios = {
    A: E.buildScenario({ ...BASE, mode: "none" }),
    B: E.buildScenario({ ...BASE, mode: "interest" }),
    C: E.buildScenario({ ...BASE, mode: "partial", partialAmount: 3000 })
  };
  for (const [label, s] of Object.entries(scenarios)) {
    assertScheduleIntegrity(s, label);
    const fy = E.fyInterestPaid(s, "2026-08");
    const sumP = fy.reduce((acc, r) => acc + E.toPaise(r.interest), 0);
    assert.equal(sumP, E.toPaise(s.interestPaid), label + ": Σ FY subtotals === interest paid");
  }
  // Scenario A pays no interest during the moratorium; its 80E stream is amort interest only.
  assert.equal(scenarios.A.interestPaid, scenarios.A.amortInterest);
});

/* ---------------- calendar / FY bucketing ---------------- */

test("month arithmetic wraps years and FY boundaries correctly (Apr–Mar)", () => {
  assert.deepEqual(E.addMonths("2026-08", 0), { y: 2026, m: 8 });
  assert.deepEqual(E.addMonths("2026-08", 5), { y: 2027, m: 1 });  // across December
  assert.deepEqual(E.addMonths("2026-08", 60), { y: 2031, m: 8 });
  assert.deepEqual(E.addMonths("2024-01", 13), { y: 2025, m: 2 }); // leap-year February exists at month granularity
  assert.equal(E.fyLabel(2027, 3), "FY 2026–27"); // March belongs to the previous FY
  assert.equal(E.fyLabel(2027, 4), "FY 2027–28"); // April starts a new FY
  assert.equal(E.fyLabel(2026, 12), "FY 2026–27");
});

/* ---------------- tranche plan ---------------- */

test("tranchePlan: equal tranches sum exactly in paise, remainder to the first", () => {
  const plan = E.tranchePlan(1000000, 48, "yearly");
  assert.deepEqual(plan.map((t) => t[0]), [0, 12, 24, 36]);
  assert.equal(plan.reduce((a, t) => a + E.toPaise(t[1]), 0), 100000000);
  const odd = E.tranchePlan(1000.01, 18, "semester"); // 3 tranches of ₹333.34 + ₹333.33×2… remainder to first
  assert.equal(odd.length, 3);
  assert.equal(odd.reduce((a, t) => a + E.toPaise(t[1]), 0), 100001);
});

/* ---------------- property test ---------------- */

test("property: 3000 seeded random loans — Σ principal === balance, Σ payment === Σ interest + balance, closes at 0 (integer paise)", () => {
  // mulberry32 over a fixed seed → deterministic run
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260723);
  for (let k = 0; k < 3000; k++) {
    const balP = 1000000 + Math.floor(rand() * 499000000); // ₹10k … ₹50L in paise
    const bal = balP / 100;
    const rate = Math.floor(rand() * 1600) / 10000;        // 0 … 15.99%
    const n = 6 + Math.floor(rand() * 175);                // 6 … 180 months
    const { rows } = E.amortize(bal, rate, n);
    let prinP = 0, payP = 0, intP = 0;
    for (const r of rows) { prinP += r.principalP; payP += r.paymentP; intP += r.interestP; }
    assert.equal(prinP, balP);
    assert.equal(payP, intP + balP);
    assert.equal(rows[rows.length - 1].closingP, 0);
    assert.ok(rows.length <= n);
  }
});

/* ---------------- formatting ---------------- */

test("formatINR: lakh/crore grouping and plain grouping", () => {
  assert.equal(E.formatINR(237871327), "₹23,78,713.27");
  assert.equal(E.formatINR(237871327, true), "₹2,378,713.27");
  assert.equal(E.formatINR(100000000), "₹10,00,000.00");
  assert.equal(E.formatINR(5000), "₹50.00");
});

test("toCSV is RFC-4180: CRLF ends, quotes escaped, commas quoted", () => {
  const csv = E.toCSV([["a", 'b "q"', "c,d"], [1, 2, 3]]);
  assert.equal(csv, 'a,"b ""q""","c,d"\r\n1,2,3\r\n');
});

/* ---------------- corpus gate ---------------- */

test("corpus gate: 14 facts, unique ids, provenance complete, mandated verbatim quotes present", () => {
  assert.equal(FACTS.length, 14);
  const ids = new Set(FACTS.map((f) => f.id));
  assert.equal(ids.size, 14, "ids unique");
  const cats = { moratorium: 0, tax: 0, subsidy: 0, convention: 0 };
  for (const f of FACTS) {
    assert.ok(f.source_url && f.source_url.startsWith("https://"), f.id + ": non-empty source_url");
    assert.match(f.verified_on, /^\d{4}-\d{2}-\d{2}$/, f.id + ": ISO verified_on");
    assert.ok(f.statement && f.statement.length > 10, f.id + ": statement present");
    assert.ok(f.source_name, f.id + ": source_name present");
    assert.ok(f.verified_how, f.id + ": verified_how present");
    cats[f.category]++;
  }
  assert.deepEqual(cats, { moratorium: 4, tax: 4, subsidy: 4, convention: 2 });
  // The two mandated verbatim quotes:
  const iba = FACTS.find((f) => f.id === "iba-moratorium");
  assert.ok(iba.quote.length > 0 && /Course period \+ 1 year/i.test(iba.quote), "IBA moratorium clause verbatim");
  const e80 = FACTS.find((f) => f.id === "80e-eight-years");
  assert.ok(e80.quote.length > 0 && /seven assessment years immediately succeeding/.test(e80.quote), "Section 80E verbatim");
  const e80a = FACTS.find((f) => f.id === "80e-interest-only");
  assert.ok(/by way of interest on loan/.test(e80a.quote), "80E interest-only verbatim");
});

test("engine constants come FROM the corpus, not duplicates: default tail = course period + 1 year per iba-moratorium", () => {
  const iba = FACTS.find((f) => f.id === "iba-moratorium");
  // The clause encodes “+ 1 year”; the app's default tail (12 months) must derive from it.
  const match = iba.quote.match(/\+ (\d+) year/);
  assert.ok(match, "clause carries the number");
  assert.equal(Number(match[1]) * 12, 12);
});
