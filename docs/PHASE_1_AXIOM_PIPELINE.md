# Phase 1 — Axiom pipeline (documentation only)

**Status:** Planning and naming reference. **No UI implementation** in this document.  
**Aligns with:** `docs/ITERLAW_RIGHTSNOW_HLD_LLD.md`, `docs/IMPLEMENTATION_READY_PIPELINE_DESIGN.md`, `docs/AXIOM_ALGORITHM_SPEC_ENGLAND_WALES_2026.md`.

---

## Engineering glossary (professional names)

### AEE — Axiom Extraction Engine

**Purpose**

- Extract **facts** from user documents and structured inputs.
- Identify **possible issues** and **clause-level flags** for follow-up.
- Surface text spans that may need human or ART review.

**Does not**

- Produce **final legal conclusions** or definitive outcomes.
- Use **direct enforcement** language (“you must sue”, guaranteed results).
- Replace solicitors, tribunals, or regulators.

---

### ART — Axiom Reasoning Tracer

**Purpose**

- Apply **source-verified** legal rules to structured facts.
- Read from the **controlled `legal_documents`** corpus and the **`legal_constants`** table (no ad hoc literals for legal calculations in production paths).
- Produce structured outputs such as **LAW / MEANING / ACTION** sections **bound to citations**.
- Provide **estimates** (ranges, caps, caveats) only where constants and sources exist.

**Does not**

- Run **open-ended** model-only legal reasoning in production without marking output **unverified** and routing to review or escalation.
- Invent citations or fill gaps from parametric knowledge when a **trusted source** or **constant row** is missing — **missing source or constant ⇒ escalation** (see implementation-ready pipeline for exact error patterns).

---

### SEA — Safe Enforcement Assistant

**Purpose**

- Generate **draft** grievance letters.
- Generate **evidence checklists**.
- Generate **ACAS early conciliation preparation** notes.
- Generate **complaint preparation packs** (e.g. FWA / HMRC / tribunal routes) **for user review** — user or representative submits; product does **not** claim automated filing.

**Does not**

- Claim **direct submission** to FWA, HMRC, or tribunals unless an **official API** is integrated and **verified** end-to-end.
- Issue **penalty threats** or “automatic” financial penalties unless **source-backed** and **legally reviewed** template tier allows the exact wording.
- Use **aggressive** or coercive language.

**Neutral wording palette (required in SEA copy)**

- “**Possible escalation**” (routes described factually).
- “**May be considered**” (options, not certainties).
- “**Seek advice**” (solicitor / ACAS / official guidance).
- “**Draft for review**” / “**Draft for user review**” on every deliverable surface.

**Avoid**

- “Victory”, guaranteed settlement, or certainty of outcome.
- Percentage multipliers on penalties without statutory citation and review (e.g. do not invent “200% penalty” narratives).

---

## Documentation and naming guardrails

**Do not use** the following classes of labels in product code, UI, or public docs:

- Metaphors framed as **sovereignty / strike / sword / “tactical” weapons / “nuke”** (or similar) for legal automation.
- **“God-tier”** or other hype superlatives for reliability or legal authority.
- **Adversarial employer** framing (e.g. “terrify employers”).
- **Hard-coded legal constants** in application logic — use **`legal_constants`** rows (see implementation-ready design).
- Claims of **direct FWA (or other regulator) submission** via product unless an official API is live and audited.
- **Automatic** or **inflated penalty** threats without primary-source backing and human review controls.

Use **engineering names** (AEE, ART, SEA) and plain descriptions of risk, review, and escalation.

---

## Phase 1 sub-phases (delivery slices)

### PHASE 1A — AEE (Axiom Extraction Engine)

| | |
|--|--|
| **Input** | User question, uploaded documents (where permitted), known case facts metadata. |
| **Output** | Structured facts model + **issue flags** + cited spans (where extraction supports offsets). |
| **Constraints** | No final legal advice; no direct enforcement commands; flags are **non-conclusive**. |

---

### PHASE 1B — ART (Axiom Reasoning Tracer)

| | |
|--|--|
| **Input** | Structured facts from **1A**. |
| **Output** | **LAW / MEANING / ACTION** (or equivalent schema) with **citations** to `legal_documents` rows and **`legal_constants`** keys used. |
| **Constraints** | No open AI-only legal reasoning on production path; **missing source or constant ⇒ escalation**; estimates clearly bounded and labelled non-binding. |

---

### PHASE 1C — SEA (Safe Enforcement Assistant)

| | |
|--|--|
| **Input** | **Approved** reasoning artefact (per review policy) + structured facts. |
| **Output** | Draft letters, evidence checklists, ACAS preparation notes, complaint preparation packs — all labelled **draft for user review**. |
| **Constraints** | No direct FWA/API submission claims; no aggressive threats; neutral language palette above. |

---

### PHASE 1D — Case Value Dashboard (design only)

| | |
|--|--|
| **Purpose** | Present **estimated claim ranges** (where ART + constants allow), **confidence**, **missing evidence** checklist, and **next safe step** (e.g. gather documents, ACAS, legal advice). |
| **Constraints** | No “victory” or **guaranteed settlement** language; no implied certainty of tribunal outcome. |
| **Implementation note** | **UI deferred** — this phase is specification and data contracts until explicitly scheduled. |

---

## Cross-reference to existing modules (LLD)

| Concept | Illustrative module names (may differ in repo) |
|---------|-----------------------------------------------|
| AEE | `aee-extraction.ts` / extraction stage in `axiom-orchestrator` |
| ART | `art-reasoning.ts` / reasoning stage |
| SEA | `sea-drafting.ts` / `enforcementDraftingService` (draft-only, user submission) |

---

**Change control:** Updates to Phase 1 scope should be reflected here first, then mirrored in handoff docs and implementation PRs.
