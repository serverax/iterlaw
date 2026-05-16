# Legal Content Audit Framework

**Purpose:** Seed data and review workflow for **200 pre-approved Q&A pairs** (PRD Section 7.2; product Sprint 1 / solicitor review Sprint 7).  
**Status:** TEMPLATE — populate rows; solicitor reviewer signs batch.  
**Jurisdiction:** England & Wales (UK Employment MVP)  
**Last updated:** 2026-05-16

**Related:** `docs/iterlaw/project/13-evaluation/LEGAL_GOLDEN_TEST_HARNESS.md`, `apps/legal-orchestrator/src/tests/fixtures/legalGoldenScenarios.ts`

---

## 1. Review workflow

```text
Draft (AI or SME) → Automated citation check → Solicitor review → Approved → Published to cache
                      ↓ fail                              ↓ reject
                   Block serve                        Return to draft + notes
```

| Stage | Owner | Output |
|-------|-------|--------|
| Draft | Legal SME + Engineering | CSV / DB rows `verification_status = unverified` |
| Automated gate | CI + `citationGate` | Block if zero citations or banned claims |
| Solicitor review | External reviewer | `human_reviewed` or `solicitor_approved` |
| Publish | Operator | Rows eligible for direct-serve (similarity ≥ 0.92 per RAG policy) |

---

## 2. Q&A record template (one row)

Copy this block for each of the 200 pairs.

```yaml
id: Q&A-XXX                    # stable slug, e.g. unfair-dismissal-qualifying-service
question: ""                   # user-facing question (plain English)
jurisdiction: "EW"             # England & Wales
situation_type: ""             # see §3
answer_law_section: ""         # LAW block — statute + section refs
answer_meaning: ""             # MEANING — apply to typical facts (no individual advice)
answer_action: ""              # ACTION — next steps (generic)
source_citation: ""            # e.g. "ERA 1996 s.94"
source_url: ""                 # legislation.gov.uk or ACAS canonical URL
effective_from: "YYYY-MM-DD"   # law version
verification_status: unverified # unverified | auto_generated | human_reviewed | solicitor_approved
confidence_score: null         # 0.00–1.00 — reviewer sets (see §5)
reviewer_id: ""
reviewed_at: ""
review_notes: ""
```

### CSV header (import)

```csv
id,question,jurisdiction,situation_type,answer_law_section,answer_meaning,answer_action,source_citation,source_url,effective_from,verification_status,confidence_score,reviewer_id,reviewed_at,review_notes
```

---

## 3. Situation types (categorisation)

Target distribution across **200** pairs (adjust with Legal SME):

| `situation_type` | Target count | Primary legislation / guidance |
|------------------|-------------|--------------------------------|
| `disciplinary` | 25 | ERA 1996; ACAS Code — disciplinary |
| `dismissal` | 30 | ERA 1996 ss.94–98; unfair dismissal |
| `redundancy` | 25 | ERA 1996 ss.135–162; collective consultation |
| `discrimination` | 25 | Equality Act 2010 |
| `suspension` | 15 | ERA 1996; implied term / contract |
| `grievance` | 20 | ERA 1996 s.203; ACAS Code — grievance |
| `notice_periods` | 20 | ERA 1996 s.86; contract notice |
| `settlement_agreements` | 20 | ERA 1996 s.203A; without prejudice |
| `whistleblowing` | 10 | PIDA 1998 |
| `acas_ec` | 10 | ERA 1996 s.207A; limitation extension |

---

## 4. Legislation link map (starter)

| Topic | Primary source | Secondary |
|-------|----------------|-----------|
| Unfair dismissal | ERA 1996 s.94 (right), s.98 (reason), s.108 (qualifying service) | [legislation.gov.uk](https://www.legislation.gov.uk/ukpga/1996/18) |
| Redundancy pay | ERA 1996 s.162 | Statutory cap — verify year in `statutoryRates` |
| Notice | ERA 1996 s.86 | |
| Discrimination | Equality Act 2010 | |
| Settlement | ERA 1996 s.203A | Independent legal advice requirement |
| ACAS EC | ERA 1996 s.207A | [acas.org.uk](https://www.acas.org.uk/) |
| Disciplinary fairness | ERA 1996 s.98(4); **ACAS Code of Practice on disciplinary** | Case law: *British Home Stores v Burchell* [1978] |

### Case law references (use sparingly; cite neutral citation)

| Case | Use for |
|------|---------|
| *Burchell* | Misconduct reasonableness test |
| *Polkey* | Procedural unfairness / compensation reduction |
| *Gisda Cyf v Barratt* | Appeal timing / effective date of dismissal |
| *Western Excavating v Sharp* | Constructive dismissal — fundamental breach |

---

## 5. Confidence score guide (solicitor reviewer)

| Score | Meaning | Approve for direct-serve? |
|-------|---------|---------------------------|
| 0.95–1.00 | Statute-clear; no material ambiguity; citation exact | Yes (`solicitor_approved`) |
| 0.85–0.94 | Clear with minor fact sensitivity; disclaimer needed in MEANING | Yes with notes |
| 0.70–0.84 | Depends on facts; must route to "speak to a solicitor" in ACTION | `human_reviewed` only |
| 0.50–0.69 | Borderline; do not auto-serve | Reject or rewrite |
| &lt; 0.50 | Incorrect or unsafe | Reject |

**Scoring dimensions**

1. **Legal accuracy** — statute section correct and in force?  
2. **Citation support** — does `source_citation` support every claim in LAW and MEANING?  
3. **Scope** — question bounded; no immigration/tax/criminal bleed?  
4. **Safety** — no "you will win", no "AI solicitor", no guaranteed outcome?  
5. **Actionability** — ACTION is generic (deadlines, ACAS, ET), not bespoke strategy?

---

## 6. Example approved row (synthetic)

```yaml
id: Q&A-001
question: "What is the minimum qualifying period for ordinary unfair dismissal?"
jurisdiction: "EW"
situation_type: "dismissal"
answer_law_section: "Under the Employment Rights Act 1996, the right not to be unfairly dismissed (s.94) generally requires two years' continuous employment for dismissals on or after 6 April 2012 (s.108(1))."
answer_meaning: "If you were dismissed with less than two years' service, you may not be able to bring an ordinary unfair dismissal claim unless an exception applies (e.g. automatically unfair reason)."
answer_action: "Check your start date and dismissal date; if you may have an automatic unfair dismissal reason, seek advice promptly."
source_citation: "ERA 1996 ss.94, 108"
source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/108"
effective_from: "2012-04-06"
verification_status: solicitor_approved
confidence_score: 0.97
```

---

## 7. Batch tracking

| Batch | IDs | Rows | Solicitor sign-off | Date |
|-------|-----|------|-------------------|------|
| 1 | Q&A-001 – Q&A-050 | 50 | | |
| 2 | Q&A-051 – Q&A-100 | 50 | | |
| 3 | Q&A-101 – Q&A-150 | 50 | | |
| 4 | Q&A-151 – Q&A-200 | 50 | | |

**Gate:** Minimum **200** `solicitor_approved` rows before launch direct-serve cache promotion.

---

## 8. Automated checks (engineering)

| Check | Implementation hint |
|-------|---------------------|
| Citation present | `citationGate` / evidence pack |
| Banned phrases | "guaranteed", "AI solicitor", "you will win" |
| Jurisdiction lock | `jurisdiction = EW` only at MVP |
| Stale law | `effective_from` / registry in `statutoryCalculatorRegistry.ts` |

---

## 9. Storage (when implemented)

| Store | Table / file | Notes |
|-------|--------------|-------|
| Canonical Q&A | `law_section_modules` or dedicated `approved_qa_pairs` | Align with RAG architecture |
| Review queue | `human_approval_queue` | Low-confidence / new rows |
