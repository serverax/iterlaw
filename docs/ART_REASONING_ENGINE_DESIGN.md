# ART — Axiom Reasoning Trace (design only)

**Status:** specification and architecture notes. **No implementation** of ART is authorized from this document until the gates below are satisfied.

**Hard stop — do not start the ART algorithm (no code, no prompts-in-prod, no new runtime paths) until:**

1. **Phase 0** is fully green on `master` (Deploy Azure Functions (IterLaw), Deploy IterLaw including Static Web App, CI — see `docs/PHASE0_GATE.md`).
2. **Phase 1** is validated against **real Supabase** (not `npm run test:phase1` mock): migration `012` applied, `qa_pool` / `trusted_content` seeded, `backend/.env` with live keys, `POST /ask` exercised, `legal_review_queue` and `ask_request_logs` confirmed in the live project.

**This document does not start Phase 2 (Vision/OCR).** It only defines how ART should behave when implementation is later approved.

---

## 1. Role of ART in the pipeline

ART sits **after** AEE (Axiom Extraction Engine — structured facts from narrative) and **before** LVC (Legal Verification Controller) and SEA (structured drafting), per the existing orchestration contract:

| Stage | Responsibility (design intent) |
|-------|----------------------------------|
| **AEE** | Deterministic or assisted **fact extraction** into a stable `extracted_facts` shape (already planned / partially present elsewhere). |
| **ART** | Build a **reasoning trace** and **structured legal conclusions** that are **traceable** to facts + approved sources — not free-form “advice” without citations. |
| **LVC** | **Validate** ART + facts: coverage, evidence, source types, consistency (already implemented in `@rightsnow/legal-core`; ART output must satisfy `VerifyLegalInput`). |
| **SEA** | Drafting **only** when LVC passes with sufficient confidence (existing gate). |

Reference types (implementation today **stub / upstream only**; ART will populate them):

- `ArtPhaseOutput` in `packages/legal-core/src/axiom/orchestrator/runAxiomPipeline.ts`: `reasoning_output`, `legal_conclusions[]`.

ART must be designed so LVC’s expectations remain satisfiable: see `packages/legal-core/src/axiom/lvc/legalVerificationController.ts` (topics, reasoning text extraction, conclusion shape hints).

---

## 2. Design goals

| Goal | Detail |
|------|--------|
| **Defensibility** | Every material legal assertion in `legal_conclusions` should carry or imply traceable **source metadata** (GOV.UK, ACAS, legislation — aligned with LVC `sourceType` rules). |
| **No silent invention** | ART must not introduce dates, tribunal outcomes, or employer acts not present in `extracted_facts` unless explicitly labeled as **hypothesis** and downgraded for LVC (prefer: omit). |
| **Separation of concerns** | ART produces **analysis + conclusions**; SEA produces **user-facing draft language** only after LVC. |
| **Auditability** | Persist or log enough trace identifiers to reconstruct which sources and which fact keys influenced each step (product policy TBD on retention). |

---

## 3. Inputs (contract from AEE)

**Primary input:** `extracted_facts: Record<string, unknown>` (same as LVC input today).

Design requirements:

- ART consumes a **versioned** AEE schema (e.g. `schema_version` field inside facts) so LVC can reason about compatibility later.
- ART should treat missing optional fields as **unknown**, not as negative evidence.

---

## 4. Outputs (contract to LVC / SEA)

### 4.1 `reasoning_output`

Support both shapes LVC already tolerates:

- **String:** concise narrative used for topic coverage regexes and text consistency checks.
- **Structured object:** optional fields such as `summary`, `trace` / `steps[]`, `topicsAddressed[]` — LVC’s `collectReasoningText` and `getTopicsAddressed` already partial-parse objects.

**Design recommendation:** canonical internal form = **structured object** with a generated **string summary** for LVC string path; avoid relying only on opaque blobs.

### 4.2 `legal_conclusions`

Array of objects. Each conclusion should minimally support (names indicative — final JSON schema in implementation phase):

| Field (conceptual) | Purpose |
|--------------------|---------|
| `claim` or `headline` | Short legal proposition. |
| `basis` | Statutory / ACAS / Gov reference identifiers (URLs or stable citation keys). |
| `strength` | Ordinal or numeric confidence for **internal** ranking (LVC may ignore or map). |
| `depends_on_facts` | Keys into `extracted_facts` that must be true for the conclusion to hold. |

LVC today treats entries as `Record<string, unknown>`; ART design should propose a **zod-validated** wire schema before coding.

---

## 5. Internal architecture (conceptual — no code)

### 5.1 Phases inside ART (logical, not deployed services)

1. **Normalize** — map AEE facts to internal canonical keys (employment type, dates, events, procedure flags).
2. **Issue spotting** — map fact patterns to **issue graph** nodes (e.g. unfair dismissal, discrimination, procedural fairness) from a **closed taxonomy** (extend `COVERAGE_TOPICS` in LVC or share a single source of truth).
3. **Source assembly** — retrieve or attach **only** pre-approved content slices (Gov/ACAS/legislation) — same policy as Phase 1 controlled answers: no uncited generative legal text as “truth”.
4. **Reasoning trace** — ordered steps: fact → issue → source span → intermediate inference → candidate conclusion (each step tagged `deterministic` | `model_assisted` for future policy).
5. **Conclusion builder** — emit `legal_conclusions[]` with dependency links to facts and sources.
6. **Self-check** — lightweight deterministic checks before returning: e.g. every conclusion has `basis`, every cited fact key exists.

### 5.2 Model vs deterministic boundary (policy)

| Layer | Allowed |
|-------|---------|
| **Deterministic** | Rule-based issue spotting from fixed taxonomy; merging source spans; formatting trace. |
| **Model-assisted (future)** | Ordering / phrasing of reasoning **within** citations bound to retrieved sources; **forbidden**: inventing citations or facts not in AEE output or source bundle. |

Until policy sign-off, default posture: **deterministic-only ART** or **model-assisted with mandatory retrieval + citation span validation** (design choice at implementation time).

---

## 6. Failure modes and degradation

| Condition | Behavior |
|-----------|----------|
| Missing critical facts for an issue | Emit **narrow** conclusions or omit issue; LVC may flag `missing_evidence`. |
| Source retrieval empty | Do not fabricate; return partial trace + `requires_review` signal via LVC path. |
| Internal inconsistency | Prefer **no conclusion** over conflicting conclusions; log structured conflict. |

---

## 7. Observability and safety

- Structured logs: `case_id`, `schema_version`, `issues_detected`, `sources_used`, `model_assisted: boolean`, **no** raw PII beyond what product policy allows.
- Rate limits and cost caps at orchestration boundary (not inside ART core).

---

## 8. Testing strategy (when implementation is allowed)

| Layer | Tests |
|-------|-------|
| **Unit** | Issue spotter from fixture facts; conclusion dependency extraction. |
| **Contract** | Every ART fixture must pass or intentionally fail LVC with expected `errors` / `warnings`. |
| **Golden** | Frozen AEE snapshots → expected ART trace shape (diffable JSON). |

---

## 9. Open questions (resolve before implementation)

1. Single **taxonomy** file shared by ART + LVC vs duplicated topic lists.
2. Where ART runs (**Azure Functions**, **Next API route**, or **batch worker**) for latency and secret handling.
3. Whether **model-assisted** ART is in scope for first ship or deferred to deterministic-only v1.
4. Persistence: store full trace in Postgres vs blob store; retention vs GDPR.

---

## 10. Revision history

| Date | Author | Note |
|------|--------|------|
| 2026-05-02 | Engineering | Initial ART design doc; explicitly pre-implementation; gated on Phase 0 + live Phase 1. |
