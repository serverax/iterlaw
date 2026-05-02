# Cruser: Phase 0 Step 8b — Handoff (shipped)

**Commit:** `e494fa3` (`feat(axiom): SSE /api/axiom/process + useAxiomEngine`)  
**Branch (current):** `phase0/step7-qa-pool` — rename to `phase0/step8b-streaming` if your process requires it.  

---

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| **Framer Motion** | **Skipped** — CSS `transition` on progress bar only (`AxiomStreamWidget`). |
| **New dependencies** | **None** for Step 8b. |
| **Orchestrator** | **`runExtractPhase` / `runReasonPhase`** from `lib/workflow/axiom-orchestrator.ts` — **not** `lib/answer/orchestrator.ts`. |
| **Persistence** | **Inside orchestrator only** — the SSE route does **not** call `saveFacts` / `saveReasoning` / `saveDocuments` again (avoids double writes). |

---

## What shipped (build order in one PR)

1. **`app/api/axiom/process/route.ts`** — `POST`, `text/event-stream`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.  
2. **`lib/axiom/stream-events.ts`** — Typed SSE payloads + `encodeSseData` (adds `timestamp` on the wire).  
3. **`hooks/useAxiomEngine.ts`** — `processExtract`, `processReason`, `processStream`, `cancel` (AbortController).  
4. **`components/dashboard/AxiomStreamWidget.tsx`** — Demo extraction flow, CSS-only progress.  
5. **`app/api/axiom/__tests__/process.test.ts`** — SSE extract + reason smoke.  
6. **`jest.config.js`** — Coverage globs for `lib/axiom`, `hooks`.

---

## Contracts (do not copy older drafts)

- **Extract:** same as `extractRequestSchema` — `caseId`, `documentText` (min **20** chars), `currentState?` (not UUID-only `caseId`).  
- **Reason:** same as `reasonRequestSchema` — `caseId`, `jurisdiction?`, **`facts[]`**, `currentState?`.  
- **Mode:** non-empty **`facts`** → reason path; else **`documentText`** → extract path.  
- **Merit field:** **`meritScore`** (camelCase) on `AxiomTrace` — not `merit_score`.  
- **Complete event:** `type: 'complete'`, `phase`, `result`, **`durationMs`**.

---

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

---

## Phase 1

Surgical dashboard can import **`useAxiomEngine`** and **`AxiomStreamWidget`** (or compose its own UI) against **`POST /api/axiom/process`**.
