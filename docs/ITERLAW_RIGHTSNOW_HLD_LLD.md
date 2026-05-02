# IterLaw / RightsNow — High-Level Design (HLD) and Low-Level Design (LLD)

**Canonical corrections (implementation-ready):** `docs/IMPLEMENTATION_READY_PIPELINE_DESIGN.md` — source allow-list rules, answer pipeline, review gate, constants-only numerics, compensation / Vento / SSP, audit fields, enforcement drafting rename, users PK guidance, and corrected HLD encryption wording. On conflict, follow that document until it is superseded.

**Phase 1 orchestration (AEE / ART / SEA + dashboard spec):** `docs/PHASE_1_AXIOM_PIPELINE.md` — professional definitions, PHASE **1A–1D** delivery slices, SEA neutral wording rules, and **documentation guardrails** (no hype naming, no direct regulator API claims, row-driven constants).

**Purpose:** Source-locked UK employment law assistance: controlled corpus first, citations required, human legal review for reusable answers, auditability.  
**Tone:** Technical only. No product hype. No claims of eliminated liability.

---

## Part A — High-Level Design (HLD)

### A.1 System context

| Layer | Responsibility |
|--------|------------------|
| **Client app** | Document upload; **client-side encryption where supported**; sends **metadata** and **ciphertext** (or envelope-wrapped keys per design) to backend; never implies data is sent **directly to the FWA** unless an **official FWA API** is integrated and verified—default UX is **“generate FWA complaint pack for user review”** for the user to submit themselves. |
| **Backend API** | Node.js + Express + TypeScript: orchestrates **AEE** (Axiom Extraction Engine), retrieval, **ART** (Axiom Reasoning Tracer), **SEA** (Safe Enforcement Assistant), **review queue**, **audit logs**, **safety gate**. |
| **Supabase PostgreSQL** | Users, cases, documents, `qa_pool_entries`, `legal_documents` (controlled corpus metadata + chunk refs), `review_queue`, `review_audit_log`, `legal_constants`; **RLS** applied after auth model is stable; **pgvector** optional **after** operational thresholds (e.g. first **50** ingested legal documents) to limit cost and governance drift. |
| **Object storage** | Supabase Storage or Azure Blob: **encrypted at rest**, **strict tenant isolation**, versioning; **do not** describe as **true zero-knowledge** unless the backend **never** decrypts user content and that property is **implemented and tested**. Default description: **client-side encryption with controlled server-side processing** where the server must decrypt for stated features (e.g. extraction). |
| **AI orchestration** | **AEE:** structured extraction and issue flags only (no final legal conclusions). **ART:** source-verified rules, `legal_documents` + `legal_constants`, estimates and LAW/MEANING/ACTION with citations; missing source or constant ⇒ escalation. **SEA:** draft grievances, checklists, ACAS notes, complaint preparation packs — **draft for user review**; neutral enforcement wording; no direct regulator API unless verified. All outputs: **citations** + **confidence score** where applicable; unverified paths flagged and routed to review. |

### A.2 Trust boundaries

1. **Trusted sources (allow-list):** `legislation.gov.uk`, `gov.uk`, ACAS official publications, official Employment Tribunal / judiciary guidance, **solicitor-approved internal case summaries** stored in `legal_documents` with provenance.  
2. **No open legal reasoning** in production paths unless explicitly marked **unverified** and **routed to review** (no silent merge with verified cache).  
3. **All reusable / cached answers** require **legal review approval** before the safety gate may serve them.

### A.3 Data flow (concise)

```
Client → TLS → API → [verify JWT/session] → persist encrypted blob ref + metadata
       → AEE (extract facts + flags, cite spans)
       → source-verification (bundle trusted sources + constants)
       → ART (route issues, apply effective dates, no invention)
       → SEA (optional drafts, neutral, "draft for user review")
       → safety-gate (cache eligibility)
       → review-queue (inactive + queue when not approvable)
       → audit log (immutable append)
```

---

## Part B — Database tables (logical schema)

| Table | Role |
|--------|------|
| `users` | Identity / profile (existing pattern). |
| `cases` | Matter container. |
| `documents` | User uploads: storage path, encryption metadata, hash, retention. |
| `legal_documents` | Controlled corpus: title, jurisdiction, `effective_from`/`effective_to`, chunk ids, embedding optional, `approved_by`, `source_url`, `source_type`. |
| `legal_constants` | Versioned numeric / band / rule flags (see LLD §1). |
| `qa_pool_entries` | Cached Q&A; legal review columns; **inactive until approved**. |
| `review_queue` | Pending human review items. |
| `review_audit_log` | Decisions and reviewer accountability. |

**Indices:** As per migrations for pool, review, and (to add) `legal_constants` by `(jurisdiction, key, effective_from)`.

---

## Part C — Low-Level Design (LLD): modules

### C.1 `legal-constants.ts` (loader + types)

**Responsibilities:** Load active constants for `(jurisdiction, as_of_date)`; never return EW rows for NI.

**Row shape (`legal_constants`):**

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `key` | text | Stable machine key |
| `jurisdiction` | text | e.g. `england_wales` |
| `value` | jsonb | Scalar, `{min,max}`, or structured rule |
| `effective_from` | date | Inclusive |
| `effective_to` | date null | Exclusive upper bound; null = open |
| `source_url` | text | Primary |
| `source_citation` | text | Short cite |
| `reviewed_by` | text/uuid | Actor |
| `reviewed_at` | timestamptz | Last verification |

**API:**

- `getConstants(jurisdiction, asOfDate): Promise<LegalConstantRow[]>`  
- `getConstant(key, jurisdiction, asOfDate): Promise<LegalConstantRow | null>`  
- `requireConstant(...):` throws or returns **escalation token** if missing.

**Rule:** `compensation-engine.ts` **imports no numeric literals** for caps; it reads **`value`** from rows. Seed data (outside TS) may define canonical numbers below.

---

### C.2 `compensation-engine.ts`

**Authoritative England/Wales seed keys (from 6 April 2026 regime — store in `legal_constants`, not inline logic):**

| Key | Value | Notes |
|-----|--------|--------|
| `WEEKLY_PAY_CAP_GBP` | `751` | Statutory week’s pay cap (ERA 1996 s.227(1)); UKSI 2026/310 Schedule. |
| `MAX_STATUTORY_REDUNDANCY_GBP` | `22530` | Derived statutory redundancy ceiling example (capped weekly × age factors × max service years); **must** match formula rows or explicit approved seed. |
| `UNFAIR_DISMISSAL_COMPENSATORY_CAP_GBP` | `123543` | ERA 1996 s.124(1ZA)(a) new limit; **also** apply “lower of cap and 52 × week’s pay (capped)” per statute. |
| `SSP_WEEKLY_RATE_GBP` | `123.25` | Lower of this and 80% AWE per in-force rules. |
| `SSP_FROM_FIRST_QUALIFYING_DAY` | `true` | From 6 April 2026 regime (store with SI/guidance cite). |
| `SSP_LEL_REMOVED` | `true` | Only if primary source row ingested confirms. |
| `NMW_21_PLUS_HOURLY_GBP` | `12.71` | National Minimum Wage rate for 21+ from relevant April 2026 rate row — **must** cite official rate source (e.g. NMW regulations / GOV.UK rate table). |
| `VENTO_LOWER_GBP` | `{min:1300,max:12600}` | Injury to feelings; claims **presented** on/after 6 April 2026 — bind to Presidential Guidance addendum row. |
| `VENTO_MIDDLE_GBP` | `{min:12600,max:37700}` | As above. |
| `VENTO_UPPER_GBP` | `{min:37700,max:62900}` | As above. |

**Pseudocode:**

```
function estimateCompensation(facts, jurisdiction, asOfDate):
  C ← getConstants(jurisdiction, asOfDate)
  if missing_required(C): return ESCALATION("insufficient_verified_limits")

  weeklyCap ← C[WEEKLY_PAY_CAP_GBP].value
  grossWeek ← min(facts.weekly_pay, weeklyCap)

  udCap ← C[UNFAIR_DISMISSAL_COMPENSATORY_CAP_GBP].value
  udComp ← min(udCap, 52 * grossWeek)  // still subject to facts + tribunal discretion disclaimer

  sspRate ← C[SSP_WEEKLY_RATE_GBP].value
  sspPay ← min(0.8 * facts.awe_weekly, sspRate)  // if AWE path applies per ruleset rows

  vento ← pickVentoBand(C, facts.presentation_date, facts.severity_hint)

  return { lines: [...], sources: attach_rows(C), disclaimers: STANDARD_NOT_ADVICE }
```

---

### C.3 `aee-extraction.ts` (AEE)

**Outputs:** Structured JSON schema (Zod): employment status, dates, service length, protected characteristics (user-asserted + doc evidence), whistleblowing, sickness/SSP, paternity/parental, redundancy, holiday pay, material contract clauses. Each field: `value | null`, `evidence_spans[]`, `confidence`.

**Flags (non-conclusive):**

| Flag | Trigger (heuristic + date-aware constant rows) |
|------|--------------------------------------------------|
| `ssp_waiting_days_post_2026` | Text encodes waiting days inconsistent with `SSP_FROM_FIRST_QUALIFYING_DAY` row. |
| `paternity_parental_service_barrier` | Denies leave based on service length inconsistent with **day-one** rows for effective date. |
| `nmw_possible_underpayment` | Pay rate vs `NMW_21_PLUS_*` keys for age band (separate rows per age if needed). |
| `holiday_pay_record_issue` | Only if checklist rule row defines detectable inconsistency. |
| `possible_discrimination` | Pattern + user markers; **never** definitive without ART + sources. |
| `possible_auto_unfair` | Pattern match against **stored** list of auto-unfair heads (jurisdiction-specific). |

---

### C.4 `art-reasoning.ts` (ART)

**Pseudocode:**

```
function reason(bundle: VerificationBundle, facts, jurisdiction):
  if bundle.trusted_sources.empty():
    return ESCALATION("no_trusted_source")

  for each issue in facts.flags:
    lawDate ← choose_effective_date(issue, facts)
    rows ← query_legal_documents(jurisdiction, lawDate, issue)
    if rows.empty(): return ESCALATION("no_corpus_match", issue)

  if issue == unfair_dismissal:
    if not facts.dismissal_date: return NEED_INFO
    if not qualifying_service(facts, lawDate):
      if not (auto_unfair | discrimination | whistleblowing | ... per trusted list):
        return ROUTE("no_ordinary_unfair_claim_without_service", sources)

  apply effective_date filters to all constant lookups
  return { conclusions: bound_to_sources(rows), confidence, citations }
```

**Rules:** No invention; **controlled `legal_documents` first**; escalation if gap.

---

### C.5 `sea-drafting.ts` (SEA)

**Outputs:** `grievance_draft`, `settlement_letter_draft`, `acas_ec_prep_note`, `fwa_complaint_pack_for_user_review` (not “submitted to FWA”), `et1_prep_summary`.

**Rules:**

- Neutral, professional; **every** paragraph that states law links `source_id` / `source_url`.  
- **No penalty threats** unless `source-verification` attaches an explicit statutory provision row allowing that sentence (default: off).  
- **No automatic entitlement** language.  
- Footer: **“Draft for user review — not legal advice.”**

---

### C.6 `source-verification.ts`

**Per legal statement object:**

```ts
interface LegalStatement {
  text: string;
  source_url: string;
  source_type: 'legislation' | 'gov_guidance' | 'acas' | 'tribunal_guidance' | 'internal_approved_summary';
  source_citation: string;
  effective_date: string; // which version of law/guidance
  confidence_score: number; // 0–1 from retrieval + hash + recency
}
```

**Behaviour:** Reject publish if any required statement lacks fields or `confidence_score < threshold_policy`.

---

### C.7 `safety-gate.ts`

**Serve cached answer only if ALL hold:**

1. `legal_reviewer_approved === true`  
2. `is_active === true`  
3. `decision in ('approved', 'approved_with_disclaimer')`  
4. `expires_at` is null or **future**  
5. **Source bundle** exists for the answer (non-empty trusted citations)  
6. `jurisdiction` on cache row **matches** request context  

Else: **do not serve**; trigger fresh pipeline or escalation.

---

### C.8 `review-queue.ts`

**On new or unverified model output:**

1. Persist `qa_pool_entries` (or equivalent) as **`is_active = false`**, `legal_reviewer_approved = false`.  
2. Insert `review_queue` row (`pending_review`).  
3. **Never** expose as verified cache until review completes with allowed `decision` and safety gate passes.

---

## Part D — Cross-module algorithm (pseudocode)

```
onUserQuery(q, docs, jurisdiction):
  cipherRef ← storeEncryptedDocs(docs)
  facts ← AEE.extract(docs, q)
  verify ← sourceVerification.buildBundle(facts, jurisdiction, today)
  if verify.escalation: return escalationResponse(verify)

  reasoning ← ART.reason(verify, facts, jurisdiction)
  if reasoning.escalation: return escalationResponse(reasoning)

  drafts ← optional SEA.draft(reasoning, user_intent)

  candidateAnswer ← compose(reasoning, drafts)
  if not safetyGate.canServeFromCache(poolRow):   // for cache hits only
     enqueueReview(candidateAnswer)
     return { mode: "pending_review", preview: redactedOrSummary }

  audit.log(...)
  return { answer: candidateAnswer, citations, confidence }
```

---

## Part E — Test cases

| ID | Scenario | Expected |
|----|-----------|----------|
| E1 | NI user, only EW constants | No EW numbers applied; escalation or NI corpus required |
| E2 | Query with no `legal_documents` match | Escalation, no fabricated statute |
| E3 | Cache row missing `source_url` | Safety gate **blocks** serve |
| E4 | `decision = rejected` | Never served as verified |
| E5 | `expires_at` in past | Block serve |
| E6 | SEA draft contains penalty threat | Blocked by template linter + source check |
| E7 | Product copy says “we submit to FWA” | **Rejected** — replace with user-review pack language |
| E8 | Marketing claims zero-knowledge | **Rejected** — use agreed encryption phrasing |
| E9 | Ordinary unfair dismissal, service 8 weeks, no auto-unfair head | ART states no ordinary unfair dismissal claim without qualifying service (with cite) |
| E10 | Compensation without `WEEKLY_PAY_CAP` row | Engine returns escalation, no numbers |
| E11 | SSP calculation, AWE > rate cap | Pay uses `min(0.8*AWE, 123.25)` only when rows exist |
| E12 | Vento claim presented 2026-04-05 vs 2026-04-06 | Different band rows if guidance boundary dictates |

---

## Part F — Security and compliance notes

- Evidence: **encryption at rest**, RBAC, audit on read/write.  
- **Pen testing / security assessment** supports insurance readiness and reduces launch risk; it does not guarantee coverage wording.  
- **RightsNow should document DPIA, human review controls, audit logs, and source governance** (internal standard of care framing).

---

## Part G — Implementation mapping (repo)

| LLD module | Suggested path (incremental) |
|------------|-------------------------------|
| `legal-constants.ts` | `lib/axiom/legal-constants.ts` (+ extend `lib/axiom/legal-constants.types.ts`) |
| `compensation-engine.ts` | `lib/axiom/compensation-engine.ts` |
| `aee-extraction.ts` | `lib/agents/` or `lib/axiom/aee-extraction.ts` aligned with existing extract schema |
| `art-reasoning.ts` | `lib/axiom/art-reasoning.ts` |
| `sea-drafting.ts` | `lib/axiom/sea-drafting.ts` |
| `source-verification.ts` | `lib/axiom/source-verification.ts` |
| `safety-gate.ts` | `lib/qa-pool/safety-gate.ts` or `lib/axiom/safety-gate.ts` |
| `review-queue.ts` | `lib/review-queue/service.ts` (alongside DB) |

---

**Revision:** HLD/LLD only; no runtime behaviour changed unless separately tasked.
