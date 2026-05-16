# Sprint 0-Rem-D: Down Migration Completion

## Summary

- **Status:** PASS
- **Objective:** Add missing `.down.sql` files for early RAG/core migrations
- **Branch:** `feature/0-rem-d-down-migrations`

## Missing Down Migrations Fixed

- `001_legal_rag_foundation.down.sql`
- `005_legal_chunks_applicable_to.down.sql`
- `100_iterlaw_core_rag_foundation.down.sql`
- `101_reconcile_legal_rag_schema.down.sql`
- `102_add_legal_cases_table.down.sql`

## Final Migration Inventory

| Metric | Count |
|---|---:|
| Up migrations | 51 |
| Down migrations | 51 |
| Missing down migrations | 0 |

## Rollback Design Notes

- `001_legal_rag_foundation.down.sql` is intentionally destructive and drops foundational RAG tables in dependency-safe order.
- `005_legal_chunks_applicable_to.down.sql` reverses only the `legal_chunks.applicable_to` column.
- `100_iterlaw_core_rag_foundation.down.sql` treats migration 100 as the documented draft/compatibility shim. It removes draft-specific objects and additive compatibility columns without dropping canonical `legal_sources`, `legal_documents`, or `legal_chunks`.
- `101_reconcile_legal_rag_schema.down.sql` drops the four additive reconciliation tables in dependency order.
- `102_add_legal_cases_table.down.sql` drops the canonical `public.legal_cases` table and its indexes.

## Verification

| Check | Result |
|---|---|
| Missing down migration inventory | PASS, 0 missing |
| SQL structure scan | PASS, generated files contain DROP/ALTER/DO statements as applicable |
| `npm run validate:migrations` | PASS, 9 files / 127 tests |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 136 files / 3,013 tests |

## Limitations

No live database rollback was executed in this sprint. The verification was static plus migration-focused tests. Full rollback execution should be performed against a disposable PostgreSQL database before applying these reversals to any persistent environment.

## Sign-Off

Complete.
