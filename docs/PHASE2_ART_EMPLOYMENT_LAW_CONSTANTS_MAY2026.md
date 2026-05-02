# Phase 2 ART — employment-law constants (design notes, May 2026)

**Status:** design documentation only for a future **constants catalogue** used by the **ART** (Axiom Reasoning Trace) layer in **Phase 2**.  
**Not implemented:** there is **no** TypeScript module, no imports, and no runtime use of these figures in this commit.

**Non-advice:** this file is a **data dictionary** for engineering. It does **not** provide legal advice, tribunal strategy, or employer/employee guidance. ART must not treat these rows as permission to “generate advice” without separate product, legal, and safety review.

**Verification:** figures and URLs were cross-checked against primary or high-trust secondary sources **on 2026-05-02**. Re-verify before any implementation against the live `source_url` (especially PDFs and annual uplifts).

**Naming note (`FWA_MAX_*`):** the identifiers `FWA_MAX_PENALTY_PERCENT` and `FWA_MAX_PENALTY_PER_WORKER` are kept **exactly as requested** for Phase 2 ART naming stability. The **values** (200% and £20,000 per worker) match the **National Minimum Wage Act 1998** enforcement / notice-of-underpayment penalty regime as described on **GOV.UK** and HMRC manuals — **not** the Employment Relations (Flexible Working) Act 2023. Rename or split constants before implementation if product/legal prefers different labels.

---

## Catalogue (future module shape)

Each row is the intended shape of a future exported constant:

| Proposed export name | Value (design) | `source_url` | `source_name` | `effective_date` | `last_verified_at` |
|----------------------|----------------|--------------|---------------|------------------|---------------------|
| `SSP_DAY_ONE_EFFECTIVE_DATE` | `"2026-04-06"` | https://www.gov.uk/guidance/sickness-absences-that-start-before-and-end-on-or-after-6-april-2026 | GOV.UK — sickness absences crossing 6 April 2026 (SSP reforms) | 2026-04-06 | 2026-05-02 |
| `SSP_WEEKLY_RATE` | `123.25` | https://www.gov.uk/guidance/sickness-absences-that-start-before-and-end-on-or-after-6-april-2026 | GOV.UK — same guidance (weekly flat rate from 6 April 2026) | 2026-04-06 | 2026-05-02 |
| `SSP_EARNINGS_PERCENTAGE` | `0.80` | https://www.gov.uk/guidance/sickness-absences-that-start-before-and-end-on-or-after-6-april-2026 | GOV.UK — SSP as 80% of AWE or flat rate, whichever is lower | 2026-04-06 | 2026-05-02 |
| `WEEKLY_PAY_CAP` | `751` | https://www.legislation.gov.uk/uksi/2026/310/made | The Employment Rights (Increase of Limits) Order 2026 (SI 2026/310) — limit on a week’s pay | 2026-04-06 | 2026-05-02 |
| `UNFAIR_DISMISSAL_COMPENSATORY_CAP` | `123543` | https://www.legislation.gov.uk/uksi/2026/310/made | The Employment Rights (Increase of Limits) Order 2026 — compensatory award limit (ordinary unfair dismissal) | 2026-04-06 | 2026-05-02 |
| `NATIONAL_LIVING_WAGE_21_PLUS` | `12.71` | https://www.gov.uk/national-minimum-wage-rates | GOV.UK — National Minimum Wage and National Living Wage rates | 2026-04-01 | 2026-05-02 |
| `VENTO_LOWER` | `[1300, 12600]` | https://www.judiciary.uk/guidance-and-resources/employment-rules-and-legislation-practice-directions/ | Courts and Tribunals Judiciary — Employment Tribunal rules / guidance hub (injury to feelings / Vento bands published via Presidential Guidance addenda; confirm current PDF) | 2026-04-06 | 2026-05-02 |
| `VENTO_MIDDLE` | `[12600, 37700]` | https://www.judiciary.uk/guidance-and-resources/employment-rules-and-legislation-practice-directions/ | Same as `VENTO_LOWER` | 2026-04-06 | 2026-05-02 |
| `VENTO_UPPER` | `[37700, 62900]` | https://www.judiciary.uk/guidance-and-resources/employment-rules-and-legislation-practice-directions/ | Same as `VENTO_LOWER` | 2026-04-06 | 2026-05-02 |
| `COLLECTIVE_REDUNDANCY_PROTECTIVE_AWARD_DAYS` | `180` | https://www.business.gov.uk/campaign/employment-changes/employee/protective-awards-for-collective-redundancy/ | GOV.UK Business Companion campaign — collective redundancy protective award (confirm against primary legislation as amended) | 2026-04-06 | 2026-05-02 |
| `FWA_MAX_PENALTY_PERCENT` | `200` | https://www.gov.uk/government/publications/enforcing-national-minimum-wage-law/national-minimum-wage-policy-on-enforcement-prosecutions-and-naming-employers-who-break-national-minimum-wage-law | GOV.UK — National Minimum Wage enforcement policy (penalty as percentage of underpayment) | ongoing (policy; confirm operative dates for each pay reference period) | 2026-05-02 |
| `FWA_MAX_PENALTY_PER_WORKER` | `20000` | https://www.gov.uk/guidance/calculating-the-minimum-wage/enforcing-the-minimum-wage | GOV.UK — Calculating the minimum wage / enforcement (penalty caps per worker) | ongoing (policy; confirm operative dates) | 2026-05-02 |
| `TRIBUNAL_TIME_LIMIT_6_MONTHS_EFFECTIVE` | `"2026-10"` | https://www.legislation.gov.uk/ukpga/2025/17/contents | Employment Rights Act 2025 — commencement / time-limit provisions (confirm exact month and claim types in force) | 2026-10 (anticipated) | 2026-05-02 |

---

## Vento bands — interpretation of bracket values

- `VENTO_LOWER`, `VENTO_MIDDLE`, `VENTO_UPPER` are documented as **inclusive monetary ranges in GBP** for the lower, middle, and upper **Vento** injury-to-feelings bands for claims presented from **6 April 2026**, matching the design values you supplied.  
- **Implementation detail (future):** decide whether the future module stores **integers** (`1300`) or **decimals** (`1300.00`) and whether bounds are **inclusive** at both ends; tribunal practice should be confirmed with current Presidential Guidance addendum PDFs.

---

## `TRIBUNAL_TIME_LIMIT_6_MONTHS_EFFECTIVE`

- Stored as **`"2026-10"`** (string month) per your specification: it marks the **policy window** when the extended **6-month** limitation regime is expected to bite for relevant claims, subject to **commencement orders** under the **Employment Rights Act 2025**.  
- **Before implementation:** replace the month string with a machine date or an explicit `{ act, section, commencement_reg }` reference once the exact **in-force** date is published on legislation.gov.uk.

---

## Revision history

| Date | Note |
|------|------|
| 2026-05-02 | Initial Phase 2 ART constants design sheet (documentation only; no code module). |
