# Sprint 39 — Approved-answer fast-path persistence Tier-0 store

## Verdict: PASS

Tier-0 store interface + in-memory implementation delivered with a key builder that covers every required dimension: tenant, country, module, normalised question hash, source/citation version, entitlement scope. Write-time refusal contract enforces approved-only, cited-only, non-expired, non-empty-answer. 21 vitest cases. Default remains OFF — the Sprint 27 fast-path wiring still requires an injected lookup, which now has a concrete in-memory implementation operators can consume.

## Files

- `apps/legal-orchestrator/src/retrieval/approvedAnswerStore.ts` (new — pure module, sha256 via node built-in).
- `apps/legal-orchestrator/src/retrieval/index.ts` — public re-exports.
- `apps/legal-orchestrator/src/tests/approvedAnswerStore.test.ts` (new — 21 cases).

## Key design (matches the Sprint 39 spec)

```
buildApprovedAnswerKey({
  tenantId,           // operator's tenant boundary
  country,            // jurisdiction
  moduleId,           // law-module id
  question,           // normalised before hashing
  contextSourceHash,  // source-snapshot version
  entitlementScope,   // operator-supplied identifier
  citationVersion?,   // optional citation-registry version tag
})
=> sha256("tenant:..|country:..|module:..|q:..|ctx:..|ent:..|cit:..")
```

Every dimension contributes to the key. Changing any of them produces a different key (verified by 7 dimension-isolation cases).

## Refusal contract at `put` time

| Condition | Reason |
|---|---|
| `qaStatus !== "approved"` | `qa_status_not_approved` |
| `citationCount <= 0` | `no_citations` |
| empty / whitespace `answerText` | `missing_answer_text` |
| `expiresAt < now` at write time | `expired_at_write_time` |

**No uncited answer can be persisted.** This is the same gate the Sprint 26 read-side fast path enforces — but moved earlier (refusal at write rather than at read).

## Isolation contracts (verified)

- Two tenants with the same question → different keys → no cross-read.
- Two modules with the same question + tenant → different keys.
- Two countries → different keys.
- Stale citation version → different key → cache miss (entry from old version unreachable from new key).
- Entitlement mismatch → different key → cache miss.

## Invalidation

`store.invalidate((key, entry) => boolean)` removes all matching entries and returns the count. Operators can use this to invalidate (e.g.) every entry for a given moduleId after a citation-registry upgrade.

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/approvedAnswerStore.test.ts
 ✓ src/tests/approvedAnswerStore.test.ts (21 tests) 12ms
TEST_EXIT=0
```

## Production gate impact

None. The Sprint 27 fast-path flag still defaults OFF. This sprint just provides a concrete `ApprovedAnswerLookup` (read side) the operator can wire when ready.

## What this sprint does NOT do

- Does **not** wire the in-memory store into `handleLegalRequest`. Sprint 27 wiring is shadow-mode only.
- Does **not** ship a Redis / Postgres backend. The interface allows future backends behind the same contract.
- Does **not** persist anything across process restarts (in-memory only).
- Does **not** invoke any LLM. Does **not** read `process.env`.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
