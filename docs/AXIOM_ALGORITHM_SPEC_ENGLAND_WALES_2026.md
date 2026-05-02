# RightsNow Axiom — Technical Algorithm Specification (England & Wales)

**Canonical corrections:** `docs/IMPLEMENTATION_READY_PIPELINE_DESIGN.md` (hostname allow-list, no AI-as-verified-answer, review gate, qualifying service / parental leave from `legal_constants` only, year-by-year redundancy-style weeks, Vento separated, SSP qualifying days, audit fields, enforcement drafting, Vento seeding until April 2026 addendum URL is pinned).

**Phase 1 naming and delivery slices:** `docs/PHASE_1_AXIOM_PIPELINE.md` — **AEE** (Axiom Extraction Engine), **ART** (Axiom Reasoning Tracer), **SEA** (Safe Enforcement Assistant), PHASE **1A–1D**, and neutral SEA wording (no hype / no unverified regulator API claims).

**Scope:** Algorithm design for extraction, reasoning, compensation estimates, FWA-style correspondence, source verification, confidence scoring, legal review queue integration, audit logging, and **versioned legal constants**.  
**Jurisdiction default in this document:** England and Wales only. **Northern Ireland, Scotland, and other jurisdictions require separate constant sets and sources before any numeric or procedural rule is applied.**  
**Principle:** No production answer, estimate, or enforcement draft is produced from model parametric knowledge alone. **RightsNow must maintain a defensible standard of care** by binding outputs to **retrieved, versioned sources** or returning **escalation / referral**.

**Governance wording (required):**

- Use: **“RightsNow must maintain a defensible standard of care.”** Do not claim: “Employment law requires demonstrable duty of care.”
- Use: **“RightsNow should document DPIA, human review controls, audit logs, and source governance.”** Do not claim: “ICO requires solicitor review before launch.”
- Use: **“Pen testing / security assessment supports insurance and reduces launch risk.”** Do not claim: “Insurance will not cover without pen test.”

---

## 1. Versioned legal constants

### 1.1 Storage

**Preferred:** Postgres table `legal_constants` (or equivalent) with immutable insert-only versioning (new row per change; `effective_to` closes prior row).

**Alternate:** Signed, versioned JSON bundle in object storage with hash pinned in DB; runtime verifies hash before load.

### 1.2 Row schema (required fields)

Every constant or band **row** MUST include:

| Field | Purpose |
|--------|---------|
| `id` | Stable UUID |
| `key` | Machine key, e.g. `statutory_weeks_pay_cap_gbp`, `ssp_weekly_rate_gbp`, `vento_lower_min_gbp` |
| `jurisdiction` | `england_wales` \| `northern_ireland` \| … (never assume cross-applicability) |
| `effective_from` | Inclusive date (ISO 8601 date) |
| `effective_to` | Exclusive end date or `null` if current |
| `value_json` | Structured payload (number, band `{min,max}`, formula parameters, text of statutory reference snippet where needed) |
| `source_url` | Canonical primary source (legislation.gov.uk, official tribunal guidance PDF, statutory instrument) |
| `source_citation` | Human-readable cite (e.g. “The Employment Rights (Increase of Limits) Order 2026, Schedule, row for s.227(1) ERA 1996”) |
| `verified_by` | Actor ID (internal user / role / workflow step), not free-text marketing |
| `reviewed_at` | Timestamp of last human or controlled workflow verification |

TypeScript contract (no values): `lib/axiom/legal-constants.types.ts`.

### 1.3 England & Wales figures supplied for 6 April 2026 (bind only after row ingestion)

These numbers MUST appear only as **database (or signed config) rows**, not as literals inside `compensation-engine.ts` / reasoning modules.

| Key (example) | Value / rule | Primary source (illustrative — store verbatim in `source_url` / `source_citation`) |
|-----------------|----------------|----------------------------------------------------------------------------------------|
| Statutory week’s pay cap | **£751** / week for caps under ERA 1996 s.227(1) from relevant effective date | [The Employment Rights (Increase of Limits) Order 2026, Schedule](https://www.legislation.gov.uk/uksi/2026/310/schedule/made) — table row “Section 227(1) of the 1996 Act … New Limit £751” |
| Unfair dismissal compensatory award cap | **£123,543** (subject to statutory rules including relationship to a week’s pay where applicable) | Same Schedule — row “Section 124(1ZA)(a) of the 1996 Act … New Limit £123,543” |
| SSP weekly rate | **£123.25** or **80% of average weekly earnings**, **whichever is lower** | Operational rate and formula must be tied to **in-force** regulations / GOV.UK employer guidance for the pay period; **ingest `source_url` for the specific SI or guidance version** used at runtime |
| SSP waiting days | **Removed — SSP from first qualifying day** (per legislative framework in force from relevant date) | Same: **only** after stored constant + citation row exists for the version used |
| Paternity / unpaid parental leave | **Day-one rights** (where statute in force says so) | Separate rows per entitlement with **Act + section / SI** URLs — do not copy EW figures to NI |
| Vento injury to feelings bands (claims **presented** on or after 6 April 2026) | Lower **£1,300–£12,600**; Middle **£12,600–£37,700**; Upper **£37,700–£62,900** | **Must** cite the **Presidential Guidance addendum** PDF in force for that presentation date on [Employment Tribunal (England & Wales) guidance](https://www.judiciary.uk/guidance-and-resources/employment-rules-and-legislation-practice-directions/) (exact filename/version changes — if the published addendum differs, **the database row wins** and product must **not** silently use this document’s numbers) |

**Rule:** If `source_url` cannot be resolved or `reviewed_at` is stale against policy, **do not** emit numeric advice — return **escalation / referral** payload.

---

## 2. Module: `source-verification.ts`

**Responsibilities**

1. Resolve which **constant keys** and **corpus documents** are in scope for `jurisdiction` + `as_of_date` + user `presentation_date` (for Vento) + `dismissal_date` / `SSP_period`.
2. Fetch primary materials via **allow-listed hosts** (e.g. `legislation.gov.uk`, `judiciary.uk`, `gov.uk`) with caching, TLS, and integrity hash of canonical body where feasible.
3. Return a **VerificationBundle**: `{ sources: [{ url, citation, retrieved_at, sha256? }], missing: string[], escalation_required: boolean }`.
4. Never fabricate citations; if a URL is 404 or content hash drift fails, set `escalation_required: true`.

**Outputs to downstream modules:** Only pass `VerificationBundle` + **loaded `LegalConstantRow[]`** into extraction/reasoning/compensation.

---

## 3. Module: `axiom-extraction.ts`

**Responsibilities**

- Produce **structured flags** with **verbatim spans** from user documents (contracts, policies, payslips text, emails), not legal conclusions.
- Each flag includes: `flag_id`, `evidence_quote`, `char_offsets | page`, `confidence` (see §8), `requires_human_review` (boolean).

**England/Wales rules (6 April 2026 regime) — extraction only**

| Flag | Condition to set | Note |
|------|------------------|------|
| `ssp_waiting_days_post_2026` | Text imposes waiting days **after** removal date in stored constant row | Requires `effective_from` for SSP rules row in DB |
| `paternity_parental_service_barrier_post_2026` | Denies or conditions paternity / unpaid parental leave on **26 weeks’ service** (or similar) where day-one row exists | Compare against **stored** statutory text hash, not model memory |
| `holiday_pay_record_inconsistency` | Set only where a **stored checklist rule** (from verified HR / payroll guidance row) defines detectable inconsistency | If no checklist row → **no flag** |
| `criminal_offence_claim` | **Never** set unless a **retrieved** statutory text explicitly creates a criminal offence relevant to the clause | Default: omit |

**Forbidden:** Claiming “criminal requirement” without legislation text in bundle.

---

## 4. Module: `axiom-reasoning.ts`

**Responsibilities**

- Combine **extracted facts**, **VerificationBundle**, and **LegalConstantRow[]** into **issue routing** and **non-numeric** or **numeric** outputs per policy.
- **Effective date discipline:** Every path must select rows where `effective_from ≤ relevant_date ≤ effective_to ?? +∞`.

**Routing (examples)**

| Topic | Behaviour |
|--------|-----------|
| Pay, SSP, holiday pay, NMW-type breaches | Route to **enforcement / escalation** templates **and** compensation engine **only** if constants + sources present |
| Unfair dismissal | Always require **qualifying service** facts and **dismissal date**; fetch unfair-dismissal **qualifying period** from **stored** constant / primary law row for that date |
| Service &lt; 6 months | **Do not** assume ordinary unfair dismissal applies unless a **stored** list of **day-one / automatic unfair / discrimination** routes matches extracted facts |
| Service ≥ 6 months | Apply unfair-dismissal logic **only** if **in-force** law rows confirm the regime for that dismissal date |

**If law uncertain:** Escalation response — no fabricated “likely outcome.”

---

## 5. Module: `compensation-engine.ts`

**Inputs:** `jurisdiction`, `as_of_date`, `dismissal_date` (if any), `presentation_date` (for Vento), `weekly_pay_gross`, `facts` (age bands, years of service, etc.), `LegalConstantRow[]`, `VerificationBundle`.

**Behaviour**

1. Load caps: **week’s pay cap** and **compensatory cap** from rows keyed to ERA provisions per [UKSI 2026/310 Schedule](https://www.legislation.gov.uk/uksi/2026/310/schedule/made); apply **lower of actual weekly pay and cap** where statute requires.
2. **SSP:** `min(0.8 * AWE_weekly, ssp_rate_weekly)` using **only** ingested rate row; respect **waiting-day** rules from ingested row (post–6 April 2026 row should encode “from day one” per your verified package).
3. **Vento:** pick band min/max from ingested rows for `presentation_date`; output **range + disclaimer** — not a point estimate unless human review tier allows.
4. **52-week pay interaction** where applicable: encode as **formula rows** referencing statute sections, not hardcoded prose from the model.
5. **Output shape:** `{ estimates: [...], caps_applied: [...], sources: [...], disclaimers: string[], escalation: boolean }`.

**No literals** for £751, £123,543, £123.25, or Vento numbers in this module — only reads from `value_json`.

---

## 6. Module: `fwa-enforcer.ts` (neutral correspondence)

**Principles**

- **Do not** threaten penalties unless a **source-backed** constant or retrieved statutory provision explicitly supports the statement **and** legal review policy marks the template tier as allowed.
- Drafts must: **(1)** identify alleged breach in neutral terms, **(2)** cite **stored** source id/url, **(3)** request correction/payment, **(4)** describe **possible** escalation routes (e.g. ACAS, ET claim) **without** overstating automatic penalties.

**Output:** `letter_draft`, `cited_source_ids[]`, `risk_flags[]`, `requires_legal_review: true` for any first-use template or penalty-adjacent language.

---

## 7. Controlled legal dataset & retrieval

- **Corpus:** Versioned documents (statutes, SI schedules, official guidance PDFs, **in-force** ET Presidential Guidance). Store `content_hash`, `jurisdiction`, `effective_range`, `access_tier`.
- **Retrieval:** Supabase + **pgvector** (optional) for **controlled** semantic retrieval over **ingested** corpus chunks only — never open-web RAG for legal conclusions.
- **Evidence storage:** Encryption at rest, strict RBAC, audit on read/write. **Do not** claim zero-knowledge unless architected, implemented, and independently tested.

---

## 8. Confidence scoring

Multiplicative or weighted model (example factors — tune empirically):

| Factor | Effect |
|---------|--------|
| Source present & hash match | ↑ |
| Constant row `reviewed_at` within SLA | ↑ |
| Extraction span short / ambiguous | ↓ |
| Jurisdiction mismatch risk | ↓ → escalation |
| Criminal / penalty / ICO-style claims requested | ↓ → block or escalate |

Thresholds drive: **auto_publish** vs **legal_review_queue** vs **referral_only**.

---

## 9. Legal review queue integration

- Pool/cache rows (see separate product schema) carry `legal_reviewer_approved`, `is_active`, `decision`, `expires_at`, etc.
- **Only** rows that pass **all** of: `is_active`, `legal_reviewer_approved`, `decision === 'approved'` (per your policy enum), **and** non-expired `expires_at` may be used as **precedent cache** for end users.
- Anything failing the gate → **regenerate** or **human path** per product policy (align with Step 3 safety gate in roadmap).

---

## 10. Audit logging

Immutable append-only log: `actor`, `action`, `input_hash`, `output_hash`, `constant_version_ids[]`, `source_urls[]`, `jurisdiction`, `timestamp`, `correlation_id`.  
Retention and DPIA alignment: **RightsNow should document DPIA, human review controls, audit logs, and source governance.**

---

## 11. Test cases (representative)

| # | Scenario | Expected |
|---|-----------|----------|
| T1 | `jurisdiction=northern_ireland`, EW constants only in DB | No EW numerics applied; escalation or NI row required |
| T2 | `dismissal_date` 2025-09-01, request 2026 cap | Engine selects **2025/26** row for week’s pay cap, not 2026 row |
| T3 | Missing `legal_constants` row for SSP rate | No SSP calculation; escalation |
| T4 | Contract states “3 waiting days” for SSP from 2026-05-01 | `ssp_waiting_days_post_2026` flag with quote |
| T5 | Policy denies paternity for &lt;26 weeks’ service, presentation 2026-05-01 | `paternity_parental_service_barrier_post_2026` if day-one row ingested |
| T6 | User asks “criminal liability?” without statute in bundle | No criminal claim; neutral escalation |
| T7 | FWA draft requests “automatic £10k penalty” | Blocked unless source row `penalty_threat_allowed=true` (default false) |
| T8 | Vento: `presentation_date` 2026-04-05 vs 2026-04-06 | Different band rows if your ingested guidance defines boundary |
| T9 | Compensation: weekly pay £900, dismissal ≥ 2026-04-06 | Capped at **£751** with citation to s.227 row |
| T10 | Compensatory award estimate hits statutory cap | Output shows **£123,543** cap from s.124 row + disclaimer on individual facts |

---

## 12. Implementation checklist (engineering)

1. Create `legal_constants` table + seed from **primary** URLs only.  
2. Implement `source-verification.ts` allow-list + cache + hash.  
3. Implement loaders: `getActiveConstants(jurisdiction, as_of_date)`.  
4. Wire **Axiom orchestrator** to refuse numeric outputs if `escalation_required`.  
5. Unit tests for T1–T10 + property test: **no numeric literal** for caps in engine source (lint rule or AST grep).  
6. Security: pen test / assessment tracked as **risk reduction**, not insurance guarantee.

---

**Document status:** Design specification. **Figures for Vento and SSP operational details** must be reconciled with the **exact** published materials active on the claim / pay dates at deploy time; discrepancies are resolved by **updating rows**, not code literals.
