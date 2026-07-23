/* eduloan — UI layer. All math lives in data/engine.js; all facts in data/facts.js.
   No inline handlers (CSP); everything is wired here via addEventListener. */
(function () {
  "use strict";

  const E = window.EDULOAN_ENGINE;
  const $ = (id) => document.getElementById(id);

  const LS_SAVED = "eduloan.saved.v1";
  const LS_LAST = "eduloan.last.v1";

  const factById = (id) => FACTS.find((f) => f.id === id);

  /* ---------------- input state ---------------- */

  function clamp(x, lo, hi, fallback) {
    const n = Number(x);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  }

  function readConfig() {
    return {
      amount: clamp($("in-amount").value, 10000, 100000000, 1000000),
      ratePct: clamp($("in-rate").value, 0, 24, 10),
      courseMonths: Math.round(clamp($("in-course").value, 1, 120, 48)),
      tailMonths: Math.round(clamp($("in-tail").value, 0, 36, 12)),
      tenureYears: Math.round(clamp($("in-tenure").value, 1, 15, 10)),
      startYM: /^\d{4}-\d{2}$/.test($("in-start").value) ? $("in-start").value : "2026-08",
      disbursement: $("in-disburse").value,
      partial: clamp($("in-partial").value, 0, 1000000, 3000),
      compounding: $("in-compound").checked,
      plain: $("in-plain").checked,
      csis: $("csis-eligible").checked
    };
  }

  function applyConfig(c) {
    $("in-amount").value = c.amount;
    $("in-rate").value = c.ratePct;
    $("in-course").value = c.courseMonths;
    $("in-tail").value = c.tailMonths;
    $("in-tenure").value = c.tenureYears;
    $("in-start").value = c.startYM;
    $("in-disburse").value = c.disbursement;
    $("in-partial").value = c.partial;
    $("in-compound").checked = !!c.compounding;
    $("in-plain").checked = !!c.plain;
    $("csis-eligible").checked = !!c.csis;
  }

  /* ---------------- compute ---------------- */

  let state = null; // { cfg, A, B, C, activeTab }
  let activeTab = "A";

  function compute(cfg) {
    const base = {
      amount: cfg.amount,
      annualRate: cfg.ratePct / 100,
      courseMonths: cfg.courseMonths,
      tailMonths: cfg.tailMonths,
      tenureMonths: cfg.tenureYears * 12,
      disbursement: cfg.disbursement,
      compounding: cfg.compounding
    };
    return {
      cfg,
      A: E.buildScenario({ ...base, mode: "none" }),
      B: E.buildScenario({ ...base, mode: "interest" }),
      C: E.buildScenario({ ...base, mode: "partial", partialAmount: cfg.partial })
    };
  }

  const fmt = (rupees) => E.formatINR(E.toPaise(rupees), state.cfg.plain);
  const fmtP = (paise) => E.formatINR(paise, state.cfg.plain);

  /* ---------------- render: cards + verdict ---------------- */

  function monthName(ym, k) {
    const { y, m } = E.addMonths(ym, k);
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[m - 1] + " " + y;
  }

  function renderCards() {
    const { A, B, C, cfg } = state;
    $("a-cap").textContent = fmt(A.capitalisedBalance);
    $("a-emi").textContent = fmt(A.emi) + "/mo";
    $("a-int").textContent = fmt(A.totalInterest);
    $("a-out").textContent = fmt(A.totalOutflow);
    $("b-cap").textContent = fmt(B.capitalisedBalance);
    $("b-emi").textContent = fmt(B.emi) + "/mo";
    $("b-int").textContent = fmt(B.totalInterest);
    $("b-out").textContent = fmt(B.totalOutflow);
    $("c-cap").textContent = fmt(C.capitalisedBalance);
    $("c-emi").textContent = fmt(C.emi) + "/mo";
    $("c-int").textContent = fmt(C.totalInterest);
    $("c-out").textContent = fmt(C.totalOutflow);
    $("c-sub").textContent = fmt(cfg.partial).replace(".00", "") + " every month";

    const dB = E.round2(A.totalOutflow - B.totalOutflow);
    const dC = E.round2(A.totalOutflow - C.totalOutflow);
    const firstServicing = B.moratoriumRows.length ? B.moratoriumRows[0].paymentP : 0;

    $("b-delta").innerHTML = dB > 0
      ? "Serving the interest (from " + esc(fmtP(firstServicing)) + "/mo) during study saves <strong>" + esc(fmt(dB)) + "</strong> over the loan vs full moratorium."
      : "At this rate there is no interest to serve — nothing to save vs full moratorium.";
    $("c-delta").innerHTML = dC > 0
      ? "Paying " + esc(fmt(cfg.partial)) + "/mo during study saves <strong>" + esc(fmt(dC)) + "</strong> over the loan vs full moratorium."
      : "At this rate partial payments change nothing vs full moratorium.";

    $("verdict").innerHTML = dB > 0
      ? "Doing nothing during the moratorium costs <strong>" + esc(fmt(A.totalOutflow)) + "</strong> in total. " +
        "Serving the interest instead saves <strong>" + esc(fmt(dB)) + "</strong>; even " + esc(fmt(cfg.partial)) +
        "/mo saves <strong>" + esc(fmt(dC)) + "</strong>. EMI starts " + esc(monthName(cfg.startYM, A.moratoriumMonths)) + "."
      : "At a 0% rate all three paths cost the same: <strong>" + esc(fmt(A.totalOutflow)) + "</strong>.";

    // CSIS annotation — never changes the math
    const note = $("a-csis-note");
    if (cfg.csis) {
      note.hidden = false;
      note.textContent = "CSIS self-declared: Scenario A's moratorium interest of " + fmt(A.accruedInterest) +
        " would be borne by GoI if approved — confirm with your bank. Figures above are shown WITHOUT the subsidy.";
    } else {
      note.hidden = true;
    }

    $("model-label").textContent = cfg.compounding
      ? "monthly compounding (your bank's variation)"
      : "simple interest (IBA model scheme)";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------------- render: chart (the moratorium wedge) ---------------- */

  function balanceSeries(s) {
    // Monthly balance incl. unpaid accrual through moratorium, then amort closings.
    const pts = [];
    let prevUnpaid = 0;
    for (const r of s.moratoriumRows) {
      pts.push(r.disbursedP + r.unpaidP);
      prevUnpaid = r.unpaidP;
    }
    for (const r of s.amortRows) pts.push(r.closingP);
    return pts;
  }

  function principalSeries(s, totalMonths) {
    const pts = [];
    for (let m = 0; m < s.moratoriumRows.length; m++) pts.push(s.moratoriumRows[m].disbursedP);
    while (pts.length < totalMonths) pts.push(null); // wedge only spans the moratorium
    return pts;
  }

  function renderChart() {
    const { A, B, C, cfg } = state;
    const W = 1000, H = 360, padL = 74, padR = 16, padT = 18, padB = 40;
    const mor = A.moratoriumMonths;
    const sA = balanceSeries(A), sB = balanceSeries(B), sC = balanceSeries(C);
    const total = Math.max(sA.length, sB.length, sC.length);
    const maxV = Math.max(...sA, ...sB, ...sC, 1);
    const x = (m) => padL + (m / total) * (W - padL - padR);
    const y = (v) => padT + (1 - v / maxV) * (H - padT - padB);

    const path = (pts) => pts.map((v, k) => (k === 0 ? "M" : "L") + x(k).toFixed(1) + " " + y(v).toFixed(1)).join(" ");

    // wedge polygon: principal baseline up, A-balance back down, over the moratorium
    const prin = principalSeries(A, total);
    let wedge = "";
    for (let m = 0; m < mor && m < sA.length; m++) wedge += (m === 0 ? "M" : "L") + x(m).toFixed(1) + " " + y(prin[m]).toFixed(1) + " ";
    for (let m = Math.min(mor, sA.length) - 1; m >= 0; m--) wedge += "L" + x(m).toFixed(1) + " " + y(sA[m]).toFixed(1) + " ";
    wedge += "Z";

    // y gridlines at quarters
    let grid = "";
    for (let q = 0; q <= 4; q++) {
      const v = (maxV * q) / 4;
      grid += '<line x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(v).toFixed(1) + '" class="gridline"/>' +
        '<text x="' + (padL - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" class="axis" text-anchor="end">' + esc(compactINR(v)) + "</text>";
    }
    // x labels every 2 years
    let xlab = "";
    for (let m = 0; m <= total; m += 24) {
      xlab += '<text x="' + x(m).toFixed(1) + '" y="' + (H - padB + 24) + '" class="axis" text-anchor="middle">' + esc(monthName(cfg.startYM, m)) + "</text>";
    }

    const capX = x(mor).toFixed(1);
    const svg =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="presentation" aria-hidden="true">' +
      "<defs>" +
      '<pattern id="wedgeHatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<line x1="0" y1="0" x2="0" y2="7" class="hatch-line"/></pattern></defs>' +
      grid + xlab +
      '<path d="' + wedge + '" fill="url(#wedgeHatch)" class="wedge"/>' +
      '<line x1="' + capX + '" y1="' + padT + '" x2="' + capX + '" y2="' + (H - padB) + '" class="cap-tick"/>' +
      '<text x="' + capX + '" y="' + (padT - 4 + 14) + '" class="axis cap-label" text-anchor="middle">capitalisation → EMI begins</text>' +
      '<path d="' + path(sA) + '" class="path-a" fill="none"/>' +
      '<path d="' + path(sB) + '" class="path-b" fill="none"/>' +
      '<path d="' + path(sC) + '" class="path-c" fill="none"/>' +
      '<g class="legend" transform="translate(' + (padL + 10) + "," + (padT + 8) + ')">' +
      '<line x1="0" y1="6" x2="26" y2="6" class="path-a"/><text x="32" y="10" class="axis">A · full moratorium</text>' +
      '<line x1="0" y1="26" x2="26" y2="26" class="path-b"/><text x="32" y="30" class="axis">B · interest served</text>' +
      '<line x1="0" y1="46" x2="26" y2="46" class="path-c"/><text x="32" y="50" class="axis">C · partial</text>' +
      "</g></svg>";

    $("chart").innerHTML = svg;
    $("chart-caption").textContent =
      "By the capitalisation tick (" + monthName(cfg.startYM, mor) + ") the wedge has grown to " + fmt(A.accruedInterest) +
      " of accrued interest on scenario A. Balances at EMI start — A: " + fmt(A.capitalisedBalance) +
      ", B: " + fmt(B.capitalisedBalance) + ", C: " + fmt(C.capitalisedBalance) + ".";
  }

  function compactINR(paise) {
    const r = paise / 100;
    if (r >= 10000000) return "₹" + E.round2(r / 10000000) + " Cr";
    if (r >= 100000) return "₹" + E.round2(r / 100000) + " L";
    if (r >= 1000) return "₹" + Math.round(r / 1000) + "k";
    return "₹" + Math.round(r);
  }

  /* ---------------- render: schedule ---------------- */

  function scenarioByTab() {
    return activeTab === "A" ? state.A : activeTab === "B" ? state.B : state.C;
  }

  function renderSchedule() {
    const s = scenarioByTab();
    const cfg = state.cfg;
    const body = $("sched-body");
    const rows = [];
    let prevUnpaid = 0;

    let yearMark = -1;
    for (const r of s.moratoriumRows) {
      const yr = Math.floor(r.m / 12);
      if (yr !== yearMark) {
        yearMark = yr;
        rows.push('<tr class="year-row"><td colspan="7">Moratorium year ' + (yr + 1) + " · " + esc(monthName(cfg.startYM, yr * 12)) + " onward</td></tr>");
      }
      const openP = r.disbursedP + prevUnpaid;
      const closP = r.disbursedP + r.unpaidP;
      rows.push("<tr class=\"phase-mor\"><td>" + esc(monthName(cfg.startYM, r.m)) + "</td><td>Moratorium</td>" +
        '<td class="num">' + esc(fmtP(openP)) + '</td><td class="num">' + esc(fmtP(r.accrualP)) + "</td>" +
        '<td class="num">' + esc(fmtP(r.paymentP)) + '</td><td class="num">—</td><td class="num">' + esc(fmtP(closP)) + "</td></tr>");
      prevUnpaid = r.unpaidP;
    }

    yearMark = -1;
    const n = s.amortRows.length;
    for (let k = 0; k < n; k++) {
      const r = s.amortRows[k];
      const monthIndex = s.moratoriumMonths + r.m - 1;
      const yr = Math.floor((r.m - 1) / 12);
      if (yr !== yearMark) {
        yearMark = yr;
        rows.push('<tr class="year-row"><td colspan="7">Repayment year ' + (yr + 1) + " · " + esc(monthName(cfg.startYM, s.moratoriumMonths + yr * 12)) + " onward</td></tr>");
      }
      const cls = k === n - 1 ? ' class="final-row"' : "";
      rows.push("<tr" + cls + "><td>" + esc(monthName(cfg.startYM, monthIndex)) + "</td><td>EMI " + r.m + "</td>" +
        '<td class="num">' + esc(fmtP(r.openingP)) + '</td><td class="num">' + esc(fmtP(r.interestP)) + "</td>" +
        '<td class="num">' + esc(fmtP(r.paymentP)) + '</td><td class="num">' + esc(fmtP(r.principalP)) + '</td><td class="num">' + esc(fmtP(r.closingP)) + "</td></tr>");
    }
    body.innerHTML = rows.join("");
    $("sched-caption").textContent = "Scenario " + activeTab + " schedule: moratorium accrual rows, then amortization rows grouped by year, closing at exactly zero.";
  }

  function renderFY() {
    const s = scenarioByTab();
    const fy = E.fyInterestPaid(s, state.cfg.startYM);
    $("fy-body").innerHTML = fy.length
      ? fy.map((r) => '<tr class="fy-row"><td>' + esc(r.fy) + " · scenario " + activeTab + '</td><td class="num">' + esc(fmt(r.interest)) + "</td></tr>").join("")
      : '<tr><td colspan="2">No interest is paid in scenario ' + activeTab + " until repayment begins.</td></tr>";
  }

  /* ---------------- render: statute + CSIS + rules ---------------- */

  function renderStatics() {
    const f1 = factById("80e-interest-only");
    const f2 = factById("80e-eight-years");
    $("s80e-quote").textContent = "“" + f1.quote + "” … “" + f2.quote + "”";
    $("s80e-cite").textContent = f1.source_name + " — verified " + f1.verified_on + " · " + f1.source_url;

    const csisIds = ["csis-full-subsidy", "csis-income-ceiling", "csis-loan-cap", "csis-courses-once"];
    $("csis-list").innerHTML = csisIds.map((id) => {
      const f = factById(id);
      return "<li><span>" + esc(f.statement) + '<span class="clause">“' + esc(f.quote) + "” — verified " + esc(f.verified_on) + "</span></span></li>";
    }).join("");

    const order = { moratorium: 0, tax: 1, subsidy: 2, convention: 3 };
    const catName = { moratorium: "IBA model scheme", tax: "Section 80E", subsidy: "CSIS", convention: "Convention" };
    $("facts-panel").innerHTML = FACTS.slice().sort((a, b) => order[a.category] - order[b.category]).map((f) =>
      '<article class="fact"><div class="f-head"><span class="f-cat">' + esc(catName[f.category]) + "</span>" +
      '<span class="f-src">verified ' + esc(f.verified_on) + "</span></div>" +
      '<p class="f-statement">' + esc(f.statement) + "</p>" +
      (f.quote ? '<blockquote class="f-quote">“' + esc(f.quote) + "”</blockquote>" : "") +
      '<p class="f-src">' + esc(f.source_name) + " · " + esc(f.verified_how) + " · " +
      '<a href="' + esc(f.source_url) + '" rel="noopener">source</a></p></article>'
    ).join("");
  }

  /* ---------------- print sheet ---------------- */

  function renderPrintSheet() {
    const { A, B, C, cfg } = state;
    $("print-assumptions").textContent =
      "Assumptions: sanctioned " + fmt(cfg.amount) + " at " + cfg.ratePct + "% p.a. (held constant); course " +
      cfg.courseMonths + " months + " + cfg.tailMonths + "-month tail (moratorium " + A.moratoriumMonths +
      " months); repayment " + cfg.tenureYears + " years; disbursement " +
      (cfg.disbursement === "lump" ? "lump sum at month 0" : "equal " + cfg.disbursement + " tranches") +
      "; accrual model: " + (cfg.compounding ? "monthly compounding" : "simple interest per the IBA model scheme") +
      "; course starts " + monthName(cfg.startYM, 0) + ", EMI starts " + monthName(cfg.startYM, A.moratoriumMonths) + ".";
    const card = (tag, name, s, extra) =>
      '<article class="card"><h3>' + tag + " · " + name + "</h3><dl class=\"figs\">" +
      "<div><dt>Balance at EMI start</dt><dd>" + esc(fmt(s.capitalisedBalance)) + "</dd></div>" +
      "<div><dt>EMI</dt><dd>" + esc(fmt(s.emi)) + "/mo</dd></div>" +
      "<div><dt>Total interest</dt><dd>" + esc(fmt(s.totalInterest)) + "</dd></div>" +
      "<div><dt>Total outflow</dt><dd>" + esc(fmt(s.totalOutflow)) + "</dd></div></dl>" +
      (extra ? '<p class="delta">' + extra + "</p>" : "") + "</article>";
    const dB = E.round2(A.totalOutflow - B.totalOutflow);
    const dC = E.round2(A.totalOutflow - C.totalOutflow);
    $("print-cards").innerHTML = '<div class="cards">' +
      card("A", "Full moratorium", A, "Baseline.") +
      card("B", "Interest served", B, dB > 0 ? "Saves " + esc(fmt(dB)) + " vs A." : "") +
      card("C", "Partial " + esc(fmt(cfg.partial)) + "/mo", C, dC > 0 ? "Saves " + esc(fmt(dC)) + " vs A." : "") +
      "</div>";
  }

  /* ---------------- CSV export ---------------- */

  function downloadCSV() {
    const s = scenarioByTab();
    const cfg = state.cfg;
    const rows = [["month", "phase", "opening_rupees", "interest_rupees", "payment_rupees", "principal_rupees", "closing_rupees"]];
    let prevUnpaid = 0;
    for (const r of s.moratoriumRows) {
      const openP = r.disbursedP + prevUnpaid;
      const closP = r.disbursedP + r.unpaidP;
      rows.push([monthName(cfg.startYM, r.m), "moratorium", (openP / 100).toFixed(2), (r.accrualP / 100).toFixed(2),
        (r.paymentP / 100).toFixed(2), "", (closP / 100).toFixed(2)]);
      prevUnpaid = r.unpaidP;
    }
    for (const r of s.amortRows) {
      rows.push([monthName(cfg.startYM, s.moratoriumMonths + r.m - 1), "emi", (r.openingP / 100).toFixed(2),
        (r.interestP / 100).toFixed(2), (r.paymentP / 100).toFixed(2), (r.principalP / 100).toFixed(2), (r.closingP / 100).toFixed(2)]);
    }
    const blob = new Blob([E.toCSV(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eduloan-scenario-" + activeTab + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------------- saved scenarios (localStorage only) ---------------- */

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_SAVED)) || {}; } catch { return {}; }
  }

  function renderSaved() {
    const saved = loadSaved();
    const names = Object.keys(saved).sort();
    $("saved-list").innerHTML = names.length
      ? names.map((n) => {
          const c = saved[n];
          return '<li><span class="s-name">' + esc(n) + '</span><span class="s-meta">' +
            esc(E.formatINR(E.toPaise(c.amount), c.plain)) + " · " + esc(c.ratePct) + "% · course " + esc(c.courseMonths) + "m</span>" +
            '<button type="button" class="btn" data-load="' + esc(n) + '">Load</button>' +
            '<button type="button" class="btn" data-del="' + esc(n) + '">Delete</button></li>';
        }).join("")
      : '<li class="saved-empty">Nothing saved yet. Name the current inputs and press Save.</li>';
  }

  /* ---------------- main render ---------------- */

  function renderAll() {
    renderCards();
    renderChart();
    renderSchedule();
    renderFY();
    renderPrintSheet();
    try { localStorage.setItem(LS_LAST, JSON.stringify(state.cfg)); } catch { /* storage may be unavailable */ }
  }

  function recompute() {
    state = compute(readConfig());
    renderAll();
  }

  /* ---------------- events ---------------- */

  $("loan-form").addEventListener("input", recompute);
  $("loan-form").addEventListener("submit", (e) => e.preventDefault());
  $("csis-eligible").addEventListener("change", recompute);

  for (const tab of ["A", "B", "C"]) {
    $("tab-" + tab).addEventListener("click", () => {
      activeTab = tab;
      for (const t of ["A", "B", "C"]) $("tab-" + t).setAttribute("aria-pressed", String(t === tab));
      renderSchedule();
      renderFY();
    });
  }

  $("csv-btn").addEventListener("click", downloadCSV);
  $("print-btn").addEventListener("click", () => window.print());

  $("save-btn").addEventListener("click", () => {
    const name = $("save-name").value.trim() || "Scenario " + new Date().toISOString().slice(0, 10);
    const saved = loadSaved();
    saved[name] = state.cfg;
    try { localStorage.setItem(LS_SAVED, JSON.stringify(saved)); } catch { /* full/unavailable */ }
    $("save-name").value = "";
    renderSaved();
  });

  $("saved-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const saved = loadSaved();
    if (btn.dataset.load && saved[btn.dataset.load]) {
      applyConfig(saved[btn.dataset.load]);
      recompute();
    } else if (btn.dataset.del) {
      delete saved[btn.dataset.del];
      try { localStorage.setItem(LS_SAVED, JSON.stringify(saved)); } catch { /* ignore */ }
      renderSaved();
    }
  });

  /* ---------------- boot ---------------- */

  try {
    const last = JSON.parse(localStorage.getItem(LS_LAST));
    if (last && typeof last === "object") applyConfig({ ...readConfig(), ...last });
  } catch { /* first visit */ }

  renderStatics();
  renderSaved();
  recompute();
})();
