/* eduloan — corpus of clause-cited facts.
   Every fact carries provenance: source_name, source_url, verified_on (ISO), verified_how.
   The engine and UI read rules FROM this file; numbers are never duplicated in app.js.
   Categories: moratorium (IBA model scheme) | tax (Section 80E) | subsidy (CSIS) | convention.
   Honesty note: iba.org.in's own scheme PDF was unreachable at build time (404/JS-gated);
   IBA-scheme facts are verified across two member-bank implementations of the model scheme
   (Bank of Maharashtra, Canara Bank) plus a secondary summary (TaxGuru), and are labelled
   verified_how accordingly. CSIS facts come from the official scheme guidelines PDF
   (staged in sources/). Section 80E is quoted verbatim from the statute text. */

const FACTS = [
  // ---------------- (a) IBA Model Educational Loan Scheme ----------------
  {
    id: "iba-moratorium",
    category: "moratorium",
    statement: "Repayment holiday (moratorium) is the course period plus one year; EMIs begin only after it ends.",
    quote: "Course period + 1 year (Uniform 1 year moratorium for repayment after completion of studies)",
    source_name: "Bank of Maharashtra — Model Education Loan Scheme (IBA model implementation)",
    source_url: "https://bankofmaharashtra.bank.in/model-education-loan-scheme",
    verified_how: "IBA's own scheme PDF unreachable at build; clause cross-checked on two member-bank pages (Bank of Maharashtra, Canara Bank) implementing the IBA model scheme",
    verified_on: "2026-07-23"
  },
  {
    id: "iba-simple-interest",
    category: "moratorium",
    statement: "During the moratorium the bank charges simple interest; compounding starts only after repayment begins.",
    quote: "Simple interest during moratorium period, there after compounded monthly",
    source_name: "Bank of Maharashtra — Model Education Loan Scheme (IBA model implementation)",
    source_url: "https://bankofmaharashtra.bank.in/model-education-loan-scheme",
    verified_how: "IBA's own scheme PDF unreachable at build; clause cross-checked against member-bank scheme pages",
    verified_on: "2026-07-23"
  },
  {
    id: "iba-capitalisation",
    category: "moratorium",
    statement: "Interest accrued during the moratorium is added to the principal, and the EMI is set on that total when repayment starts.",
    quote: "At the start of repayment period, the interest accrued is clubbed with principal & EMI is calculated accordingly.",
    source_name: "TaxGuru — Salient features of Model Education Loan Scheme",
    source_url: "https://taxguru.in/finance/salient-features-model-education-loan-scheme.html",
    verified_how: "Secondary summary of the IBA model scheme; consistent with member-bank pages and the CSIS guidelines' description of post-moratorium repayment",
    verified_on: "2026-07-23"
  },
  {
    id: "iba-tenure",
    category: "moratorium",
    statement: "Repayment tenure runs up to 15 years (180 EMIs), excluding the moratorium.",
    quote: "maximum 180 equated monthly instalments (EMIs). (i.e. 15 years maximum excluding moratorium period)",
    source_name: "Bank of Maharashtra — Model Education Loan Scheme (IBA model implementation)",
    source_url: "https://bankofmaharashtra.bank.in/model-education-loan-scheme",
    verified_how: "Cross-checked with Canara Bank: 'Repayment of the loan will be in equated monthly Installments up to a maximum of 15 years excluding the moratorium period (i.e., course period plus one year).'",
    verified_on: "2026-07-23"
  },

  // ---------------- (b) Section 80E, Income-tax Act, 1961 ----------------
  {
    id: "80e-interest-only",
    category: "tax",
    statement: "Section 80E deducts the INTEREST you pay on an education loan — never the principal.",
    quote: "In computing the total income of an assessee, being an individual, there shall be deducted, in accordance with and subject to the provisions of this section, any amount paid by him in the previous year, out of his income chargeable to tax, by way of interest on loan taken by him from any financial institution or any approved charitable institution for the purpose of pursuing his higher education or for the purpose of higher education of his relative.",
    source_name: "Section 80E(1), Income-tax Act, 1961 (text via Indian Kanoon; incometaxindia.gov.in blocked automated access at build)",
    source_url: "https://indiankanoon.org/doc/215604/",
    verified_how: "Verbatim statute text; primary portal (incometaxindia.gov.in) returned 403 to automated fetch, so the full section text was verified on Indian Kanoon's reproduction of the Act",
    verified_on: "2026-07-23"
  },
  {
    id: "80e-eight-years",
    category: "tax",
    statement: "The deduction runs for the initial assessment year plus 7 succeeding years (8 in all), or until the interest is fully paid — whichever is earlier.",
    quote: "The deduction specified in sub-section (1) shall be allowed in computing the total income in respect of the initial assessment year and seven assessment years immediately succeeding the initial assessment year or until the interest referred to in sub-section (1) is paid by the assessee in full, whichever is earlier.",
    source_name: "Section 80E(2), Income-tax Act, 1961 (text via Indian Kanoon)",
    source_url: "https://indiankanoon.org/doc/215604/",
    verified_how: "Verbatim statute text (see 80e-interest-only for portal note)",
    verified_on: "2026-07-23"
  },
  {
    id: "80e-no-cap",
    category: "tax",
    statement: "Section 80E sets no monetary ceiling: the deduction is 'any amount paid … by way of interest' in the year.",
    quote: "any amount paid by him in the previous year, out of his income chargeable to tax, by way of interest on loan",
    source_name: "Section 80E(1), Income-tax Act, 1961 (text via Indian Kanoon)",
    source_url: "https://indiankanoon.org/doc/215604/",
    verified_how: "The section text contains no rupee ceiling; statement is of that absence, quoted from sub-section (1)",
    verified_on: "2026-07-23"
  },
  {
    id: "80e-lender-purpose",
    category: "tax",
    statement: "The loan must come from a financial institution (a bank under the Banking Regulation Act, 1949, or a notified institution) or an approved charitable institution, and be for higher education — a course pursued after the Senior Secondary Examination or its equivalent.",
    quote: "\"financial institution\" means a banking company to which the Banking Regulation Act, 1949 (10 of 1949) applies (including any bank or banking institution referred to in section 51 of that Act); or any other financial institution which the Central Government may, by notification in the Official Gazette, specify in this behalf",
    source_name: "Section 80E(3), Income-tax Act, 1961 (text via Indian Kanoon)",
    source_url: "https://indiankanoon.org/doc/215604/",
    verified_how: "Verbatim statute definitions, sub-section (3)(b); 'higher education' definition per (3)(c)",
    verified_on: "2026-07-23"
  },

  // ---------------- (c) CSIS — Central Sector Interest Subsidy Scheme ----------------
  {
    id: "csis-full-subsidy",
    category: "subsidy",
    statement: "Under CSIS, the interest that accrues during the moratorium (course period + 1 year) is borne by the Government of India for eligible accounts.",
    quote: "Interest accrued during the Moratorium period ie. Course Period plus one year will be borne by the Government of India.",
    source_name: "Guidelines of Central Sector Interest Subsidy Scheme, Ministry of Education (nodal bank guidelines PDF, staged in sources/)",
    source_url: "https://pmcaresforchildren.in/public/web-design/images/csis_subsidy.pdf",
    verified_how: "Official scheme guidelines PDF downloaded and staged at sources/csis-guidelines.pdf",
    verified_on: "2026-07-23"
  },
  {
    id: "csis-income-ceiling",
    category: "subsidy",
    statement: "CSIS is for Economically Weaker Section students with annual gross parental income up to ₹4.5 lakh (from all sources).",
    quote: "Economically Weaker Sections, i.e. students whose annual gross parental income is up to Rs.4.5 lakhs",
    source_name: "Guidelines of Central Sector Interest Subsidy Scheme, Ministry of Education",
    source_url: "https://pmcaresforchildren.in/public/web-design/images/csis_subsidy.pdf",
    verified_how: "Official scheme guidelines PDF, eligibility table (staged in sources/)",
    verified_on: "2026-07-23"
  },
  {
    id: "csis-loan-cap",
    category: "subsidy",
    statement: "The subsidy covers interest on loan amounts up to ₹10 lakh (revised scheme); above ₹7.5 lakh the collateral condition no longer bars eligibility, but subsidy stays capped at the ₹10 lakh loan limit.",
    quote: "Under the revised Scheme, entire interest accrued for loan amount up to Rs. 10.00 Lakhs during the Moratorium period i.e. Course period plus one year is subsidized for the eligible education loan accounts.",
    source_name: "Guidelines of Central Sector Interest Subsidy Scheme, Ministry of Education",
    source_url: "https://pmcaresforchildren.in/public/web-design/images/csis_subsidy.pdf",
    verified_how: "Official scheme guidelines PDF, Introduction and eligibility table (staged in sources/)",
    verified_on: "2026-07-23"
  },
  {
    id: "csis-courses-once",
    category: "subsidy",
    statement: "Eligible courses are professional/technical courses in India at NAAC-accredited institutions, NBA-accredited programmes, Institutions of National Importance, or CFTIs — and the subsidy is admissible only once (UG, PG, or integrated).",
    quote: "Professional/technical courses only from NAAC accredited Institutions or professional/ technical programmes accredited by NBA or Institutions of National importance or Central Funded Technical Institutions (CFTIs).",
    source_name: "Guidelines of Central Sector Interest Subsidy Scheme, Ministry of Education",
    source_url: "https://pmcaresforchildren.in/public/web-design/images/csis_subsidy.pdf",
    verified_how: "Official scheme guidelines PDF; 'Subsidy is admissible only once either for undergraduate or post graduate or integrated course' appears in the same table (staged in sources/)",
    verified_on: "2026-07-23"
  },

  // ---------------- (d) Conventions ----------------
  {
    id: "conv-annuity-emi",
    category: "convention",
    statement: "EMI uses the closed-form annuity formula EMI = P·i·(1+i)ⁿ ⁄ ((1+i)ⁿ − 1) with monthly rate i = annual ÷ 12, rounded half-up to the paisa — re-derived and fixture-tested in this repo's self-tests.",
    quote: "",
    source_name: "Standard annuity amortisation formula (equated monthly instalment)",
    source_url: "https://en.wikipedia.org/wiki/Equated_monthly_installment",
    verified_how: "Re-derived from first principles in test/eduloan.test.js and asserted against hand-computed fixtures to the paisa",
    verified_on: "2026-07-23"
  },
  {
    id: "conv-rate-concession",
    category: "convention",
    statement: "Some banks concede interest rate if you service interest during the moratorium — the model scheme frames it as a 'may be provided' concession, so it is bank practice, and this tool never applies any concession to the math.",
    quote: "1% interest concession may be provided to the loanees if the interest is serviced regularly as and when applied during the study period when repayment holiday is specified for interest/ repayment under the scheme. Interest concession is available only for moratorium period.",
    source_name: "Bank of Maharashtra — Model Education Loan Scheme (IBA model implementation)",
    source_url: "https://bankofmaharashtra.bank.in/model-education-loan-scheme",
    verified_how: "Member-bank scheme page; discretionary ('may be provided'), therefore surfaced as a note only and never applied to any calculation",
    verified_on: "2026-07-23"
  }
];

if (typeof module !== "undefined") module.exports = { FACTS };
