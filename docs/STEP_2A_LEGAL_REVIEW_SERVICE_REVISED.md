# STEP 2A (revised) — Legal review: types + service only

**Status:** Specification only. **Do not implement** until migration **`011_add_legal_review.sql`** is applied in Supabase **and** verified (**7** new `qa_pool_entries` columns, **2** tables, **8** indexes per STEP 1B).

**Out of scope for STEP 2A:** HTTP routes, auth, unit tests that are TODO-only (either **meaningful mocked tests** in a later step or **skip tests until STEP 2B**).

---

## 0. Preconditions (blocking)

1. **Migration 011** applied and verified (STEP 1B queries).  
2. **Schema truth:** `review_queue` and `review_audit_log` columns **exactly** as in `backend/supabase/migrations/011_add_legal_review.sql` — no assumed columns.

---

## 1. Supabase client typing

Use:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
```

Do **not** use a non-existent `Supabase` type import from `@supabase/supabase-js`.

---

## 2. Schema alignment — no `reason_for_review`

Migration **011** defines `review_queue` **without** `reason_for_review`.

**STEP 2A rule:** Do **not** add `reason_for_review` to service APIs or types unless a **follow-up migration** adds the column. Optional later: migration `012_review_queue_reason.sql` + types update — **not** part of 2A.

If free-text context is needed before 012, keep it **in application logs only** (not DB) or omit.

---

## 3. Schema alignment — no `needs_changes` / `needsChanges`

`review_audit_log.decision` CHECK (migration 011) allows only:

- `approved`
- `approved_with_disclaimer`
- `rejected`

There is **no** `needs_changes` value.

**STEP 2A rule:**

- Do **not** implement a `needsChanges` path that writes **`decision = approved`** (or any value) while meaning “changes requested” — that **corrupts the audit trail**.
- Either:
  - **A)** Add a later migration extending the CHECK constraint and pool/queue semantics to support `needs_changes` / `returned_for_edit`, **then** implement, or  
  - **B)** Omit `needsChanges` entirely until schema supports it.

**Default for 2A:** **(B)** — only **approve**, **approve_with_disclaimer**, **reject** flows that map 1:1 to allowed `decision` values.

---

## 4. Atomicity — approve / reject must not be partly successful

**Problem:** If `qa_pool_entries` is updated but `review_audit_log` insert fails, the legal trail is inconsistent.

**STEP 2A design rule:**

- **Preferred (later):** Postgres **RPC** (e.g. `legal_review_complete(...)`) that performs **all** writes in **one transaction** (`BEGIN` … `COMMIT`), returning success/failure as a single outcome.
- **Until RPC exists:** Application code must treat **audit insert failure as fatal**: after a failed audit write, **do not** report success; run compensating logic only if explicitly designed (dangerous) — **better:** fail the operation and require manual reconciliation rather than silently succeeding.

**Minimum for 2A service contract:** Document that `approveAnswer` / `rejectAnswer` (names illustrative) either call the RPC or **throw** / return error if any step after the first mutation fails, and **do not** return HTTP 200-style success to callers if audit logging did not complete.

---

## 5. Idempotency / status guard on `review_queue`

Before mutating:

- Load current `review_queue` row by `id` (or by `qa_pool_entry_id` if policy is one active row per entry).
- If `status` is already **`approved`**, **`approved_with_disclaimer`**, or **`rejected`**, **refuse** further approve/reject (return a typed error such as `ReviewQueueTerminalState`).

Do not apply duplicate transitions.

---

## 6. Disclaimer path and `review_queue.status`

When the human outcome is **approved with disclaimer**:

- `qa_pool_entries.decision` → store **`approved_with_disclaimer`** (or product-specific mirror in `decision` varchar — must match safety gate design).
- **`review_queue.status`** must become **`approved_with_disclaimer`**, **not** `approved`.

Plain **approve** (no disclaimer) → `review_queue.status = approved` and `qa_pool_entries` fields aligned with product policy.

---

## 7. Deliverables (file layout — illustrative)

Only **two** implementation artifacts in STEP 2A:

| Artifact | Responsibility |
|----------|----------------|
| `legalReview.types.ts` (path TBD under `backend/src/` or shared `lib/`) | Zod or TS types matching **011 only**: queue row, audit row, pool patch shapes, discriminated unions for approve / approve_with_disclaimer / reject payloads, error codes. |
| `legalReviewService.ts` | Methods that accept `SupabaseClient` + inputs; perform reads; **enqueue** (insert `review_queue` + inactive pool row if product requires); **approve** / **approveWithDisclaimer** / **reject** with §§4–6 rules; **no routes**. |

**Explicitly excluded from STEP 2A:** `app.ts`, Express routers, middleware auth, `reason_for_review`, `needsChanges`, TODO-only Jest files.

---

## 8. Service method sketch (signatures only — not code)

```ts
// Pseudocode signatures — implement only after 011 verified.

enqueueForLegalReview(sb: SupabaseClient, input: EnqueueInput): Promise<EnqueueResult>;

approveAnswer(sb: SupabaseClient, input: ApproveInput): Promise<void>; // or RPC wrapper
approveWithDisclaimer(sb: SupabaseClient, input: ApproveDisclaimerInput): Promise<void>;
rejectAnswer(sb: SupabaseClient, input: RejectInput): Promise<void>;
```

Each mutating method:

1. Validates **terminal state** guard (§5).  
2. Applies pool + queue updates consistent with §6.  
3. Inserts **audit** row with **`decision`** exactly matching the CHECK constraint.  
4. Ensures **atomicity** per §4 (RPC preferred; otherwise fail-hard policy documented).

---

## 9. Testing policy (STEP 2A vs 2B)

- **STEP 2A:** **No** new test files that are only `it.todo(...)`.  
- Either **skip tests** until **STEP 2B**, or add **STEP 2B** deliverable: mocked `SupabaseClient` / RPC contract tests with real assertions.

---

## 10. Checklist before first line of STEP 2A code

- [ ] Supabase: 011 verified (7 / 2 / 8).  
- [ ] Types: only columns present in 011.  
- [ ] Imports: `import type { SupabaseClient } from '@supabase/supabase-js'`.  
- [ ] No `reason_for_review` until migration adds it.  
- [ ] No `needsChanges` until CHECK + product semantics exist.  
- [ ] Approve/reject: RPC or fail-hard on partial write.  
- [ ] Terminal queue state guard.  
- [ ] `approved_with_disclaimer` updates **queue** status correctly.  
- [ ] No routes, no auth, no TODO-only tests in 2A.

---

**Next user action:** Run and verify migration **011**; then approve starting **STEP 2A implementation** against this document.
