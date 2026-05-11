# legal-orchestrator (Mother Brain skeleton — Task 4)

Status: **skeleton only**. Compiles. Has tests. Does NOT call the network.

Target cluster: OrdinoxAI K3s — namespace `ordinox-ai`, DB `ordinox_legal_ai`,
postgres service `postgres-pgvector.ordinox-ai.svc.cluster.local:5432`, ollama
service `ollama.ordinox-ai.svc.cluster.local:11434`. None of these are
contacted from this build; they are referenced by name only in code comments.

## What's in here (Task 4 scope)

- `/health`, `/ready` HTTP endpoints
- `POST /api/legal/ask` — orchestrated pipeline entry point
- Types: `LegalRequest`, `LegalResponse`, `Citation`, `Classification`, `RiskCheck`,
  `ExtractedFacts`, `RagChunk` (`src/types/legal.ts`)
- Deterministic `classifyRequest` (regex-based, ~30 rules)
- Deterministic `immediateRiskCheck` (limitation, qualifying service, ACAS,
  suspension basis checks)
- `selectModel` model router (maps classification → Ollama model tag)
- `buildLegalPrompt` (strict source-locked prompt builder)
- `StructuralCitationVerifier` (refuses any answer with zero citations)
- `policyGate` (forbidden-phrase + emoji + missing-deadline-warning blocks)
- `handleLegalRequest` orchestration entry point

## What's deliberately NOT in here

- Real RAG search (the RagPort interface is in place; default returns `[]`).
- Real Ollama call (the prompt is built but the gateway call is stubbed).
- DB persistence of answers / audit logs.
- PII redaction (Phase 4) — placeholder for future.
- Workspace access verification beyond schema-level (Phase 3).

Because the RAG port returns empty, this skeleton can only return one of:
`needs_more_facts`, `high_risk_deadline`, `insufficient_sources`. By design.
Producing a `safe_answer` requires a non-empty source list AND a working LLM,
neither of which is wired in this Task 4 skeleton.

## Build + test

```
cd apps/legal-orchestrator
npm install
npm run typecheck
npm run test
```

## Run locally

**Windows (PowerShell)** — do not chain `&&` before `$env:PORT = ...` (parse error).
Use semicolons, or the npm script below:

```powershell
Set-Location "apps\legal-orchestrator"
npm run build
$env:PORT = "3012"; node dist/server.js
# or (portable):
npm run start:3012
```

**Unix-style shell**

```
npm run build
PORT=3001 node dist/server.js
curl http://localhost:3001/health
curl http://localhost:3001/ready
curl -X POST http://localhost:3001/api/legal/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "request_id":"r1",
    "user_id":"u1",
    "workspace_id":"w1",
    "mode":"ask",
    "question":"Can my employer suspend me without telling me why?"
  }'
```

Expected response status: `needs_more_facts` (suspension_date missing) or
`insufficient_sources` (if all needed facts are supplied) — never
`safe_answer` from this skeleton.

## Project context

Builds toward the 23-phase Mother Brain bundle described in `docs/...`
(to be added). This is **only Phase 1, 2, 5, 7, 11, 12, 14 (interface), 16
(interface), 20 (skeleton)** — narrow vertical slice so the rest of the
pipeline can be slotted in incrementally without rewriting.

## Hard safety rules (already enforced in skeleton)

- No legal answer without citations: `StructuralCitationVerifier` returns
  `pass: false` if `declaredCitations` is empty.
- No external LLM: not wired.
- No emojis: `policyGate` rejects any emoji code-point in the answer.
- No "guaranteed" / "you will win" / "the tribunal will" language: blocked.
- Missing deadline warning on deadline-relevant questions: blocked.
