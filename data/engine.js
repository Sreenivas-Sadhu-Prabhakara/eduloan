/* eduloan — pure calculation engine.
   All money is computed in INTEGER PAISE; rupee values cross the API as numbers
   rounded half-up to 2 decimal places (the round2 convention below). The same
   module runs in the browser (global EDULOAN_ENGINE) and under node --test.

   Rounding convention (fixture-verified): per-row interest is rounded in rupee
   space — interestPaise = Math.round(round2(openingRupees × monthlyRate) × 100).
   EMI is the closed-form annuity rounded half-up to the paisa. The final row of
   any schedule pays opening + interest so the balance closes at exactly 0. */

"use strict";

/** Round half-up to 2 decimal places (paisa). */
function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** Rupees (float, ≤2dp intent) → integer paise. */
function toPaise(rupees) {
  return Math.round(round2(rupees) * 100);
}

/** Integer paise → rupee number with exact 2dp value. */
function toRupees(paise) {
  return paise / 100;
}

/** Closed-form annuity EMI in rupees (2dp). Zero-rate degenerates to P/n. */
function emi(principal, annualRate, months) {
  if (months <= 0) throw new RangeError("months must be > 0");
  if (annualRate === 0) return round2(principal / months);
  const i = annualRate / 12;
  const pow = Math.pow(1 + i, months);
  return round2((principal * i * pow) / (pow - 1));
}

/** Simple interest accrued on a single lump sum over `months`, rupees 2dp. */
function accruedSimple(principal, annualRate, months) {
  return round2((principal * annualRate * months) / 12);
}

/** Simple interest accrued across tranches [[monthIndex, amount], …] up to
    endMonth (exclusive accrual to end of moratorium), rupees 2dp.
    Each tranche accrues from its disbursement month to endMonth. */
function accruedSimpleTranches(tranches, annualRate, endMonth) {
  let totalP = 0;
  for (const [m, amt] of tranches) {
    totalP += toPaise(accruedSimple(amt, annualRate, Math.max(0, endMonth - m)));
  }
  return toRupees(totalP);
}

/** Monthly-rest compound balance of a lump sum after `months`, rupees 2dp. */
function compoundBalance(principal, annualRate, months) {
  const i = annualRate / 12;
  return round2(principal * Math.pow(1 + i, months));
}

/** Monthly-rest compound accrual across tranches up to endMonth, rupees 2dp. */
function accruedCompoundTranches(tranches, annualRate, endMonth) {
  let totalP = 0;
  let principalP = 0;
  for (const [m, amt] of tranches) {
    totalP += toPaise(compoundBalance(amt, annualRate, Math.max(0, endMonth - m)));
    principalP += toPaise(amt);
  }
  return toRupees(totalP - principalP);
}

/** Split a sanctioned amount into equal tranches on month boundaries.
    mode: "lump" | "yearly" | "semester". Returns [[monthIndex, rupees], …].
    Paise remainder goes to the first tranche so the parts sum exactly. */
function tranchePlan(amount, courseMonths, mode) {
  if (mode === "lump" || courseMonths <= 0) return [[0, round2(amount)]];
  const step = mode === "semester" ? 6 : 12;
  const count = Math.max(1, Math.ceil(courseMonths / step));
  const totalP = toPaise(amount);
  const baseP = Math.floor(totalP / count);
  const remP = totalP - baseP * count;
  const plan = [];
  for (let k = 0; k < count; k++) {
    plan.push([k * step, toRupees(baseP + (k === 0 ? remP : 0))]);
  }
  return plan;
}

/** Principal (paise) disbursed by the END of month m (0-based month index). */
function disbursedThrough(tranches, m) {
  let p = 0;
  for (const [tm, amt] of tranches) if (tm <= m) p += toPaise(amt);
  return p;
}

/**
 * Moratorium phase for one scenario.
 * mode: "none" (Scenario A) | "interest" (B, service the full monthly interest)
 *       | "partial" (C, pay `partialAmount` per month, capped at unpaid accrual).
 * compounding=false → simple accrual (closed-form totals; the monthly display
 * rows use round2 per month with the final month trued-up so the schedule sums
 * exactly to the closed-form figure — the same convention banks' “simple
 * interest” statements follow).
 * compounding=true → monthly-rest simulation on (principal + unpaid interest).
 * Returns { rows, accruedTotal, paidTotal, capitalisedBalance } (rupees 2dp,
 * rows carry paise ints).
 */
function moratoriumPhase(opts) {
  const { tranches, annualRate, moratoriumMonths, mode, partialAmount = 0, compounding = false } = opts;
  const i = annualRate / 12;
  const rows = [];
  const principalP = disbursedThrough(tranches, Number.MAX_SAFE_INTEGER);
  let paidP = 0;

  if (!compounding) {
    // Simple accrual. Closed-form total; monthly rows trued-up on the final month.
    const accruedTotalP = toPaise(accruedSimpleTranches(tranches, annualRate, moratoriumMonths));
    let shownAccrualP = 0;
    let accruedToDateP = 0;
    for (let m = 0; m < moratoriumMonths; m++) {
      const outP = disbursedThrough(tranches, m);
      let accP = toPaise(round2(toRupees(outP) * i));
      if (m === moratoriumMonths - 1) accP = accruedTotalP - shownAccrualP; // true-up
      shownAccrualP += accP;
      accruedToDateP += accP;
      let payP = 0;
      if (mode === "interest") payP = accP;
      else if (mode === "partial") payP = Math.min(toPaise(partialAmount), accruedToDateP - paidP);
      payP = Math.max(0, payP);
      paidP += payP;
      rows.push({ m, phase: "moratorium", disbursedP: outP, accrualP: accP, paymentP: payP, unpaidP: accruedToDateP - paidP });
    }
    // For "interest" mode the true-up makes paid === accrued exactly.
    const capP = principalP + accruedTotalP - paidP;
    return {
      rows,
      accruedTotal: toRupees(accruedTotalP),
      paidTotal: toRupees(paidP),
      capitalisedBalance: toRupees(capP)
    };
  }

  // Monthly-rest compounding.
  if (mode === "none") {
    // No payments → closed-form per tranche (fixture convention).
    const accruedTotalP = toPaise(accruedCompoundTranches(tranches, annualRate, moratoriumMonths));
    let shownAccrualP = 0;
    let poolP = 0;
    for (let m = 0; m < moratoriumMonths; m++) {
      const outP = disbursedThrough(tranches, m);
      let accP = toPaise(round2(toRupees(outP + poolP) * i));
      if (m === moratoriumMonths - 1) accP = accruedTotalP - shownAccrualP; // true-up to closed form
      shownAccrualP += accP;
      poolP += accP;
      rows.push({ m, phase: "moratorium", disbursedP: outP, accrualP: accP, paymentP: 0, unpaidP: poolP });
    }
    return {
      rows,
      accruedTotal: toRupees(accruedTotalP),
      paidTotal: 0,
      capitalisedBalance: toRupees(principalP + accruedTotalP)
    };
  }

  // Compounding with payments: month-by-month, interest on principal + unpaid pool.
  let poolP = 0;
  let accruedTotalP = 0;
  for (let m = 0; m < moratoriumMonths; m++) {
    const outP = disbursedThrough(tranches, m);
    const accP = toPaise(round2(toRupees(outP + poolP) * i));
    accruedTotalP += accP;
    poolP += accP;
    let payP = 0;
    if (mode === "interest") payP = Math.min(accP, poolP);
    else if (mode === "partial") payP = Math.min(toPaise(partialAmount), poolP);
    payP = Math.max(0, payP);
    poolP -= payP;
    paidP += payP;
    rows.push({ m, phase: "moratorium", disbursedP: outP, accrualP: accP, paymentP: payP, unpaidP: poolP });
  }
  return {
    rows,
    accruedTotal: toRupees(accruedTotalP),
    paidTotal: toRupees(paidP),
    capitalisedBalance: toRupees(principalP + poolP)
  };
}

/**
 * Amortization schedule. balance in rupees, returns rows with paise ints:
 * { m, openingP, interestP, principalP, paymentP, closingP }.
 * Convention (fixture-verified): interest = round2(openingRupees × i) per row;
 * payment = EMI except the final row, which pays opening + interest exactly.
 */
function amortize(balance, annualRate, months) {
  const i = annualRate / 12;
  const emiRupees = emi(balance, annualRate, months);
  const emiP = toPaise(emiRupees);
  let balP = toPaise(balance);
  const rows = [];
  for (let m = 1; m <= months && balP > 0; m++) {
    const intP = toPaise(round2(toRupees(balP) * i));
    let payP = emiP;
    if (m === months || balP + intP <= emiP) payP = balP + intP;
    const prinP = payP - intP;
    const closP = balP - prinP;
    rows.push({ m, openingP: balP, interestP: intP, principalP: prinP, paymentP: payP, closingP: closP });
    balP = closP;
  }
  return { emi: emiRupees, rows };
}

/**
 * Build one full scenario.
 * opts: { amount, annualRate, courseMonths, tailMonths, tenureMonths,
 *         disbursement: "lump"|"yearly"|"semester", mode: "none"|"interest"|"partial",
 *         partialAmount, compounding }
 * Returns rupee 2dp figures + row arrays (paise ints).
 */
function buildScenario(opts) {
  const {
    amount, annualRate, courseMonths, tailMonths, tenureMonths,
    disbursement = "lump", mode = "none", partialAmount = 0, compounding = false
  } = opts;
  const moratoriumMonths = courseMonths + tailMonths;
  const tranches = tranchePlan(amount, courseMonths, disbursement);
  const mor = moratoriumPhase({ tranches, annualRate, moratoriumMonths, mode, partialAmount, compounding });
  const am = amortize(mor.capitalisedBalance, annualRate, tenureMonths);

  let morPaidP = 0;
  for (const r of mor.rows) morPaidP += r.paymentP;
  let amPaidP = 0, amIntP = 0;
  for (const r of am.rows) { amPaidP += r.paymentP; amIntP += r.interestP; }

  const totalOutflowP = morPaidP + amPaidP;
  const principalP = toPaise(amount);
  return {
    tranches,
    moratoriumMonths,
    moratoriumRows: mor.rows,
    accruedInterest: mor.accruedTotal,
    moratoriumPaid: toRupees(morPaidP),
    capitalisedBalance: mor.capitalisedBalance,
    emi: am.emi,
    amortRows: am.rows,
    amortInterest: toRupees(amIntP),
    interestPaid: toRupees(morPaidP + amIntP), // the 80E-relevant stream: interest actually paid
    totalOutflow: toRupees(totalOutflowP),
    totalInterest: toRupees(totalOutflowP - principalP)
  };
}

/* ---------------- calendar helpers (month granularity, FY = April–March) ---------------- */

/** "YYYY-MM" + k months → { y, m } with m in 1..12 (month arithmetic, no day clamp needed). */
function addMonths(startYM, k) {
  const [y0, m0] = startYM.split("-").map(Number);
  const t = (y0 * 12 + (m0 - 1)) + k;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

/** Indian financial-year label for a calendar {y, m}: FY runs April→March. */
function fyLabel(y, m) {
  const startY = m >= 4 ? y : y - 1;
  return "FY " + startY + "–" + String((startY + 1) % 100).padStart(2, "0");
}

/**
 * Per-financial-year INTEREST PAID subtotals for a scenario, anchored at
 * courseStart ("YYYY-MM" = month 0 of the moratorium). Moratorium payments are
 * interest payments; amortization rows contribute their interest component.
 * Returns [{ fy, interest } …] in schedule order; Σ interest === interestPaid.
 */
function fyInterestPaid(scenario, courseStartYM) {
  const buckets = new Map();
  const add = (monthIndex, paise) => {
    if (paise <= 0) return;
    const { y, m } = addMonths(courseStartYM, monthIndex);
    const key = fyLabel(y, m);
    buckets.set(key, (buckets.get(key) || 0) + paise);
  };
  for (const r of scenario.moratoriumRows) add(r.m, r.paymentP);
  for (const r of scenario.amortRows) add(scenario.moratoriumMonths + r.m - 1, r.interestP);
  return Array.from(buckets, ([fy, p]) => ({ fy, interest: toRupees(p) }));
}

/* ---------------- formatting ---------------- */

/** Format paise → "1,23,456.78" (Indian lakh/crore grouping) or plain 1,000s. */
function formatINR(paise, plainGrouping = false) {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = String(abs % 100).padStart(2, "0");
  let s = String(rupees);
  if (plainGrouping) {
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } else if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    s = rest + "," + last3;
  }
  return (neg ? "−" : "") + "₹" + s + "." + p;
}

/** RFC-4180 CSV: quote fields containing comma/quote/newline, CRLF line ends. */
function toCSV(rows) {
  const esc = (v) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

const ENGINE = {
  round2, toPaise, toRupees, emi, accruedSimple, accruedSimpleTranches,
  compoundBalance, accruedCompoundTranches, tranchePlan, disbursedThrough,
  moratoriumPhase, amortize, buildScenario, addMonths, fyLabel, fyInterestPaid,
  formatINR, toCSV
};

if (typeof module !== "undefined") module.exports = ENGINE;
if (typeof window !== "undefined") window.EDULOAN_ENGINE = ENGINE;
