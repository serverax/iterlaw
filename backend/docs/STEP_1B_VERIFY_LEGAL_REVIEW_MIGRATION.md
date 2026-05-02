# STEP 1B — Verify legal review migration (`011_add_legal_review.sql`)

Run these in the **Supabase SQL Editor** after applying `backend/supabase/migrations/011_add_legal_review.sql`.

---

## 1. Confirm seven new columns on `public.qa_pool_entries`

Expected column names (all should appear in the result set):

- `legal_reviewer_approved`
- `reviewed_by_solicitor_id`
- `reviewed_at`
- `decision`
- `disclaimer_required`
- `is_active`
- `expires_at`

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qa_pool_entries'
  AND column_name IN (
    'legal_reviewer_approved',
    'reviewed_by_solicitor_id',
    'reviewed_at',
    'decision',
    'disclaimer_required',
    'is_active',
    'expires_at'
  )
ORDER BY column_name;
```

**Expected:** **7 rows** (one per column above).

---

## 2. Confirm `review_queue` exists

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'review_queue';
```

**Expected:** **1 row** with `table_name = review_queue`.

---

## 3. Confirm `review_audit_log` exists

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'review_audit_log';
```

**Expected:** **1 row** with `table_name = review_audit_log`.

---

## 4. Confirm eight indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'qa_pool_entries_approved_idx',
    'qa_pool_entries_reviewer_idx',
    'qa_pool_entries_expires_idx',
    'review_queue_status_idx',
    'review_queue_solicitor_idx',
    'review_audit_log_entry_idx',
    'review_audit_log_reviewer_idx',
    'review_audit_log_decision_idx'
  )
ORDER BY indexname;
```

**Expected:** **8 rows** with the index names listed above (order may vary).

---

## 5. Expected result summary

| Check              | Expected |
|--------------------|----------|
| New pool columns   | **7**    |
| New tables         | **2** (`review_queue`, `review_audit_log`) |
| New indexes        | **8**    |

---

## 6. Warning — defaults if columns already existed

`ADD COLUMN IF NOT EXISTS` **does not** change an existing column’s **default** or **nullability**.

If `is_active` or `disclaimer_required` (or any of the seven names) **already existed** on `qa_pool_entries` from an earlier migration with different defaults, the migration may **silently skip** adding them, and your database could still have **old** defaults (for example `is_active` default `TRUE` instead of `FALSE`).

**Action:** In SQL Editor, inspect current definitions:

```sql
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'qa_pool_entries'
  AND column_name IN ('is_active', 'disclaimer_required');
```

If defaults are wrong for your policy, run a **follow-up migration** (or one-off `ALTER COLUMN ... SET DEFAULT ...`) after review — do not assume `011` fixed pre-existing columns.
