# Sources — eduloan corpus (verified 2026-07-23)

Every fact in `data/facts.js` carries `source_name`, `source_url`, `verified_how`,
and `verified_on`. The documents/pages actually consulted are staged here so the
corpus can be re-verified without the network.

## (a) IBA Model Educational Loan Scheme — facts `iba-*`, `conv-rate-concession`

**Honesty note:** iba.org.in's own scheme document was unreachable at build time —
the circular page (`iba.org.in/circulars/iba-model-educational-loan-scheme-…-2022-_1456.html`)
exists but serves its attachment behind JavaScript, and the retail-banking scheme
page 404s. The four scheme facts were therefore cross-checked across **two member-bank
implementations of the model scheme plus one secondary summary**, which agree verbatim
on every clause used:

| File | Source | What it verifies |
| --- | --- | --- |
| `bom-model-education-loan-scheme.html` | Bank of Maharashtra — Model Education Loan Scheme | moratorium = course period + 1 year; simple interest during moratorium, thereafter compounded monthly; 180 EMIs / 15 years max; 1% concession clause |
| `canara-iba-model-scheme.html` | Canara Bank — IBA Model Education Loan Scheme | "up to a maximum of 15 years excluding the moratorium period (i.e., course period plus one year)" |
| `taxguru-model-scheme-salient-features.html` | TaxGuru — Salient features of Model Education Loan Scheme | "At the start of repayment period, the interest accrued is clubbed with principal & EMI is calculated accordingly." |

## (b) Section 80E, Income-tax Act, 1961 — facts `80e-*`

**Honesty note:** incometaxindia.gov.in and indiacode.nic.in both returned HTTP 403
to automated fetches at build time. The full statutory text (sub-sections (1)–(3)
with all definitions) was verified verbatim on Indian Kanoon's reproduction of the Act.

| File | Source | What it verifies |
| --- | --- | --- |
| `indiankanoon-section-80e.html` | Indian Kanoon — Section 80E in The Income Tax Act, 1961 (`indiankanoon.org/doc/215604/`) | verbatim sub-sections (1), (2), (3)(a)–(e): interest-only deduction, initial AY + 7 succeeding years, no monetary cap, financial-institution/approved-charitable-institution + higher-education definitions |

## (c) CSIS — Central Sector Interest Subsidy Scheme — facts `csis-*`

| File | Source | What it verifies |
| --- | --- | --- |
| `csis-guidelines.pdf` (+ `csis-guidelines.txt` extraction) | "Guidelines of Central Sector Interest Subsidy Scheme", Ministry of Education scheme guidelines as circulated by the nodal bank (Canara Bank), mirrored at `pmcaresforchildren.in/public/web-design/images/csis_subsidy.pdf` | full moratorium-interest subsidy borne by GoI; parental income ≤ ₹4.5 lakh p.a. (all sources); subsidy on loan amount up to ₹10 lakh (revised scheme; collateral-free condition applies ≤ ₹7.5 lakh); NAAC/NBA/INI/CFTI professional-technical courses; admissible only once |
| `bom-csis-interest-subsidy.html` | Bank of Maharashtra — Interest subsidies scheme for Education Loans | cross-check of the same CSIS clauses |

## (d) Conventions — facts `conv-*`

- Closed-form annuity EMI: standard formula, re-derived from first principles and
  fixture-tested in `test/eduloan.test.js` (no external authority needed).
- Rate-concession-for-servicing: quoted from the Bank of Maharashtra scheme page
  above; discretionary ("may be provided"), so it is surfaced as a note and never
  applied to any calculation.
