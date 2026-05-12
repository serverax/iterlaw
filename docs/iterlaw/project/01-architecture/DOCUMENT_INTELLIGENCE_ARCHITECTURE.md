# Document Intelligence Architecture

How IterLaw produces cited, jurisdiction-locked legal documents (letters, claim forms, schedules) and how those documents stay safe across the lifecycle.

**Status:** target architecture. Not implemented. See `ROADMAP_REMAINING_SPRINTS.md` (Sprints 52–56). Current repo has placeholder upload tables only (Sprint 10 `legal_case_documents`).

## The `document_agent` concept

`document_agent` is one of the specialists in the Supreme Controller's agent registry (see [`SUPREME_CONTROLLER_ARCHITECTURE.md`](SUPREME_CONTROLLER_ARCHITECTURE.md)). It owns the **generation, citation, and review lifecycle** of every IterLaw-produced document.

It does **not** own:

- The drafting LLM call itself — that is `synthesiser`.
- Storage of uploaded documents — that is `case_agent`.
- The approval queue — that is `approval_agent`.

It does own:

- Selection of the document template by `(country, module, document_type)`.
- Population of the template from case facts + retrieved citations.
- Per-paragraph citation tagging.
- Confidence scoring per paragraph.
- Routing of low-confidence drafts to the human approval queue.
- Versioning + audit trail.
- Rendering to DOCX / PDF / XLSX.
- Download eligibility check (no download until approved + citations resolve).

## Storage

- Documents live in the **user's workspace** and are linked to the case timeline.
- `case_documents` (current `legal_case_documents`) stores the metadata + storage pointer.
- Generated drafts go through `legal_case_drafts` until promoted to a `case_documents` row on approval.
- Storage backend choice is operator-side; the doc layer holds only the pointer + content hash.

## Hard rules (per-document)

Every generated document must be:

| Rule | Enforced by |
| --- | --- |
| **Cited** at the paragraph level. Every paragraph that states law carries at least one citation. | `synthesiser` + `validator`. |
| **Jurisdiction locked.** The document's country + module match the case's country + module. | `document_agent` template loader + safety check. |
| **Module locked.** A grievance letter for UK Employment cannot be generated against a UK Immigration template. | Template ID is `(country, module, document_type)`. |
| **Version stamped.** Every render writes a new version row. Old versions remain readable. | `document_agent`. |
| **Audit trailed.** Each version captures generator, trigger, retrieved evidence pack, citation set, approval state. | Audit envelope per Sprint 11 redactor rules. |
| **Human-reviewed when low-confidence.** If any paragraph's confidence is below the per-module floor OR if `requires_review` is true, the document is held until a reviewer approves. | `approval_agent`. |

## Document types

First-beta scope (UK Employment) covers the document set below. Each type carries a per-module template that ships with the module's adapter.

| Type | Purpose |
| --- | --- |
| Grievance letter | Internal employer grievance, with cited legal basis. |
| Appeal letter | Internal appeal after a disciplinary / dismissal outcome. |
| Subject access request | DSAR letter under UK GDPR / DPA 2018. |
| Without prejudice letter | Negotiation / settlement discussion. |
| Constructive dismissal resignation letter | Resignation framing the breach + intention. |
| ET1 claim draft | Employment Tribunal claim form draft. |
| ET1 grounds of claim | Narrative attached to the ET1. |
| Schedule of loss | Tabular schedule (basic award, compensatory award, ACAS uplift, mitigation). |
| Witness statement | Witness statement template populated with case facts. |
| ACAS early conciliation letter | Notification framing the EC clock. |
| Case summary | Structured case-state report for the user / a solicitor. |
| Evidence log | Tabular evidence index linked to `case_documents`. |
| Timeline report | Chronological narrative drawn from `case_timeline_events`. |
| Deadline tracker | Tabular tracker drawn from `case_deadlines`. |
| Rights summary | Module-scoped summary of user rights. |
| Law section reference | A single `law_section_modules` row exported as a citable handout. |

Each type maps to a template per `(country, module, document_type)`. New types and new module adaptations are operator decisions.

## Output formats

- **DOCX** — professional legal format. Headers, footers, footnotes, formatted citations. Sprint 54.
- **PDF** — generated from DOCX or rendered direct. **Draft documents carry a watermark / seal** until approved. Sprint 54.
- **XLSX** — schedule-of-loss, deadline tracker, evidence log. Includes formulas (e.g. basic award = weeks × cap, ACAS uplift = compensation × 0.25, etc.). Sprint 55.

The renderer is a separate service. Templates live alongside the module adapter, not in this doc.

## Paragraph-level citation model

Each generated paragraph carries:

| Field | Meaning |
| --- | --- |
| `paragraph_id` | Stable id within the document version. |
| `paragraph_text` | The rendered text. |
| `legal_citation` | The cited authority (chunk id + citation label + URL). |
| `confidence` | 0.0–1.0. Per-paragraph confidence from the synthesiser. |
| `requires_review` | Boolean. Set true on any of: low confidence, novel claim, missing fact, statutory cap exceeded, deadline imminent. |

A document containing **any** paragraph with `requires_review = true` cannot be downloaded until a human reviewer approves it via the approval queue.

## Rendering rules

- **DOCX** uses the professional legal format (headed paper, citation footnotes, sections numbered).
- **PDF** is generated from the approved DOCX. Drafts are **sealed / watermarked** so a user cannot accidentally serve a draft as a final document.
- **XLSX** for schedule of loss, deadline tracker, and evidence log includes formulas — values recompute on edit, with cell-level comments explaining each line item.
- All formats embed the version stamp, generation timestamp, citation index, and an audit reference.

## Citation failure handling

If the `validator` rejects any cited URL or any cited chunk id during generation:

1. **Block the document.** Do not write a `case_documents` row that could be downloaded.
2. **Send to the human approval queue** with the failed citation + the proposed alternative evidence.
3. **Log the failure** in the audit envelope (`citation_failed`, the rejected ids — never the prompt or the answer text).
4. **Do not allow download** until a reviewer either fixes the citation or refuses to publish the document.

## Module template adapters

Each module's adapter supplies:

- `getDocumentTemplatesForModule(country, module)` — returns the available templates.
- `getCitationPolicyForModule(country, module)` — returns the per-module citation rules.
- `getCalculatorsForModule(country, module)` — returns calculators that feed XLSX schedules.

A UK Employment grievance letter and a Germany Immigration application use **different** templates, **different** citation policies, and **different** calculators.

## Status

- Sprint 10 already shipped `legal_case_documents` for uploads + `legal_case_drafts` for in-flight drafts.
- The document_agent + version model + paragraph citation model + DOCX / PDF / XLSX renderer + approval routing is **target architecture** (Sprints 52–56).
- Sprint 11 audit redactor is the contract for any logging emitted from this layer.
- Production: **BLOCKED**.

## Related

- Supreme Controller: [`SUPREME_CONTROLLER_ARCHITECTURE.md`](SUPREME_CONTROLLER_ARCHITECTURE.md)
- Multi-tier retrieval (drives the evidence pack): [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Workspace + RLS: [`WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`](WORKSPACE_AND_USER_DATA_ARCHITECTURE.md)
