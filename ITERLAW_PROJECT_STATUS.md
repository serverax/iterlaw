# IterLaw — Project Status

Last updated: 2026-05-12.

---

## TL;DR

- **Completed or mostly completed: 9 sprints.**
- **Remaining for internal MVP: 3–4 focused sprints.**
- **Remaining for public SaaS go-live: 6–7 major sprints.**
- **Next sprint: Sprint 10 — Live RAG retrieval + real UK employment law corpus ingestion.**

IterLaw is a UK employment law AI assistant. Architecture: official UK gov sources are primary, generative AI is fallback, every answer is cached. The legal answer path is deliberately not wired to an LLM yet — `retrieveLegalContext` returns `{ retrievalStatus: "not_wired" }` and the orchestrator returns `insufficient_sources`. Sprint 10 is the first sprint that promotes real chunks into the answer path.

---

## 1. What has been completed (9 sprints)

| # | Sprint | Outcome |
| --- | --- | --- |
| 1 | Phase 0 CI/CD scaffold | Next.js 14 + TypeScript strict + Supabase wiring; `.env.example` placeholders; backend/API skeletons under `backend/` and `api/`. |
| 2 | Legal pipeline core (AEE → ART → LVC → SEA) | Deterministic pipeline in `packages/legal-core/`. Citation gate, source ranker, policy gate, rule engine — all unit-tested. |
| 3 | RAG foundation (001-chain migrations) | `legal_sources`, `legal_documents`, `legal_chunks`, `legal_citations`, `legal_case_law`, `tribunal_decisions`, plus `uk_emp_rag` schema. pgvector required. |
| 4 | Sprint 6 schema additions | `ingestion_jobs`, `ingestion_job_events`, `source_fetch_audit`, `legal_document_versions`, `legal_chunk_embeddings`, `citation_registry`. |
| 5 | Sprint 9 UK employment core | `uk_emp_rag.legal_*` set, `legal_ingestion_runs`, `legal_answer_evidence`. |
| 6 | Sprint 10 source registry + 005–009 hardening | `applicable_to`, statutory rates, vento bands, superseded_by, Q&A cache with sources, rate calculation history. Statutory ladder seed (`010_*`). |
| 7 | Sprint 11 RAG hardening | QA cache schema, RAG superseded-by, rate calculation history. Comprehensive test coverage including static safety nets. |
| 8 | Namespace canonicalisation + RAG schema decision | Canonical namespaces: `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`, plus `iterlaw-data` for data plane. Parked legacy manifests under `k8s/iterlaw-disabled-master-order/`. `100_*` migration draft marked DO-NOT-APPLY. `101_reconcile_legal_rag_schema.sql` adds the four genuinely-new tables additively. `RAG_SCHEMA_CANONICAL_DECISION.md` records the decision. |
| 9 | Sprint 9 QA cleanup + backup safety baseline (this sprint) | `RightsNow` → `IterLaw` rename across active source (`@rightsnow/*` → `@iterlaw/*` in 4 workspace packages + ~30 TS imports + lockfiles). `102_add_legal_cases_table.sql` adds canonical UK case-law table. CRLF → LF normalisation of all `scripts/infra/*.sh` plus `.gitattributes`. Backup uploader image source under `apps/backup-uploader/`. SealedSecret workflow scripts. Two backup CronJobs (upload + verify) drafted with `iterlaw.io/status: draft-not-applied`. Restore-from-borg helper with `FORCE_RESTORE` guard + production-host refusal. Sealed-secret README. Tightened over-broad `/sk-[a-zA-Z0-9]{10,}/` regex to real key shapes only. |

**Test surface after Sprint 9 cleanup**: 481 tests across 44 files, all green. typecheck PASS, build PASS. Verifiers `verify-iterlaw-repo`, `verify-iterlaw-rag-db` (static), `verify-iterlaw-canonical-namespaces` all PASS. `verify-iterlaw-backup` PARTIAL with one expected WARN (Storage Box CIDR not yet pinned).

---

## 2. Blockers found and solved

| Blocker | When | Resolution |
| --- | --- | --- |
| Schema conflict — `001_*` and `100_*` define the same tables with different shapes | Sprint 8 | `RAG_SCHEMA_CANONICAL_DECISION.md` declared 001-chain canonical; `100_*` marked DO-NOT-APPLY; `101_reconcile` added only the four genuinely-new tables. |
| `legal_cases` was only in draft `100_*` | Sprint 9 cleanup | `102_add_legal_cases_table.sql` added additively to the approved chain. |
| `RightsNow` naming everywhere | Sprint 9 cleanup | Replaced across active source; legacy material under `.github/workflows-disabled/`, `k8s/iterlaw-disabled-master-order/`, `docs/CRUSER_*` retained intentionally. Active runtime carries `IterLaw` only. |
| `@rightsnow/*` npm scope | Sprint 9 cleanup | Renamed to `@iterlaw/*`; both `package-lock.json` files regenerated; `packages/legal-core/dist/` and `packages/shared/dist/` rebuilt. |
| CRLF line endings on `scripts/infra/*.sh` broke `bash -n` under Windows Git Bash | Sprint 9 cleanup | `.gitattributes` enforces LF for shell, YAML, Dockerfile, SQL, TS, JSON, MD; working tree normalised; all 15 active scripts pass `bash -n`. |
| `pg_dump` was `--format=plain --schema=uk_emp_rag` only — public schema excluded | Sprint 8 backup baseline | Widened to `--format=custom --schema=public` unconditionally with conditional `--schema=uk_emp_rag` when probed. |
| Backups lived on one cluster-local PVC only | Sprint 8/9 | Borg-to-Hetzner-Storage-Box upload CronJob, weekly verify CronJob, restore helper, repo verifier — all drafted in repo. Not yet applied (depends on image build). |
| Plain `kind: Secret` risk | All sprints | Verifier rejects plaintext `kind: Secret` outside `*.example.yaml`. SealedSecret workflow documented. Generator script refuses `REPLACE_ME` and empty values. |
| Over-broad `/sk-[a-zA-Z0-9]{10,}/` regex risked future false positives | Sprint 9 cleanup | Tightened to `/sk-(?:[A-Za-z0-9]{48,}|(?:proj\|ant\|svcacct)-[A-Za-z0-9_-]{20,})/` in 6 test files; verifier sweep already shape-anchored. |

---

## 3. Blockers still open

| Open blocker | Severity | Where |
| --- | --- | --- |
| `retrieveLegalContext` returns `not_wired`; no chunks ever reach the answer path | HIGH (Sprint 10) | `apps/legal-orchestrator/src/legal/rag/retrieveLegalContext.ts` |
| No UK employment law corpus ingested yet | HIGH (Sprint 10) | Sources listed but not fetched: `legislation.gov.uk`, GOV.UK guidance, ACAS, Find Case Law, EHRC, HMCTS, CAC |
| No local LLM gateway wired — synthesis path absent | MEDIUM (Sprint 11) | `apps/legal-orchestrator/src/legal/llm/localOllamaGateway.ts` probe-only |
| Backup uploader image not built/pushed; CronJobs reference `REPLACE_ME_DIGEST_OR_TAG` | MEDIUM (Sprint 12 or operator action) | `apps/backup-uploader/`, both CronJob manifests |
| Storage Box egress CIDR is `0.0.0.0/0` | MEDIUM (operator action) | `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` |
| No SealedSecret with real Borg credentials | MEDIUM (operator action) | `k8s/iterlaw-data/secrets/` |
| Live alerting (Telegram/webhook) wiring placeholder only | LOW | `apps/backup-uploader/entrypoint.sh` |
| AIA (autonomous interactive agent) layer not implemented | HIGH (post-MVP) | Not yet started |
| SaaS / payment / member / admin not implemented | HIGH (public go-live) | Not yet started |
| First end-to-end restore drill never executed | HIGH (gate for production traffic) | Depends on uploader image + sealed secret |

---

## 4. Remaining sprints

### Internal MVP (3–4 sprints)

| # | Sprint | Goal | Status |
| --- | --- | --- | --- |
| 10 | **Live RAG retrieval + UK employment law corpus ingestion** | Replace `not_wired` with real retrieval; ingest one verified source end-to-end; answer with cited chunks. | NEXT — see `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md`. |
| 11 | Local LLM gateway + bounded synthesis | Wire `localOllamaGateway` to a real internal Ollama (or Bifrost) endpoint behind a policy gate. No external LLM, no ungrounded output. | After Sprint 10. |
| 12 | Backup go-live | Build + push uploader image, pin digest, pin Storage Box CIDR, seal the real `iterlaw-backup-borg` Secret, apply all four backup manifests, run the first end-to-end drill. | Operator-driven. |
| 13 | MVP polish | Web UI for question entry + cited answer + document download. End-to-end QA against the seeded corpus. | After 10 + 11 + 12. |

### Public SaaS go-live (6–7 sprints total, including the MVP set)

| # | Sprint | Goal |
| --- | --- | --- |
| 14 | Member / auth / billing | Supabase Auth wiring with row-level security; subscription tiers (`free`, `pro`); rate limit per tier. |
| 15 | Admin + review queue UI | Human-in-the-loop legal review pipeline UI; approve / reject / annotate; audit log. |
| 16 | AIA (autonomous interactive agent) layer | Tool-using agent for case workspace, doc OCR, deadline tracking, follow-up questions. Outside the deterministic answer path. |
| 17 | Compliance + retention + UK GDPR | Data retention policy enforced by job; "right to be forgotten"; processing-purpose log. |
| 18 | Production hardening | Real CI on every push (workflows in `.github/workflows-disabled/` reviewed + selectively re-enabled), load test, paid SLO. |
| 19 | Public launch | Static Web Apps + Azure Functions or AKS production; status page; on-call rota. |

---

## 5. Next recommended sprint

**Sprint 10 — Live RAG retrieval + UK employment law corpus ingestion.**

Plan document: `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md`.

Goal: IterLaw answers from trusted UK employment law sources with citations, not from ungrounded LLM output. Exit criteria include at least one seeded source retrievable, a test question that returns cited chunks, and a no-source path that refuses safely. No real network calls in tests. No secrets.

---

## 6. Rules for Claude / Cursor / AIA agents

These rules sit above any per-sprint instruction. The user has stated each many times.

1. **Never push.** No `git push` without an explicit operator instruction in the same message. Even when commits are authorised.
2. **Never deploy / `kubectl apply` / `helm install`.** All manifests are reviewed by `--dry-run=server` or static verifier only.
3. **Never run `psql` against the production database.** Use the verifier scripts; they degrade to `NOT EXECUTED` when `psql` is absent.
4. **Never create real secrets in the repo.** Use `REPLACE_ME_*` placeholders and the kubeseal workflow under `k8s/iterlaw-data/secrets/README.md`.
5. **Never call external LLMs from the legal answer path.** The boundary is set in `apps/legal-orchestrator/src/legal/llm/localOllamaGateway.ts` (probe-only) and `apps/legal-orchestrator/src/legal/orchestrator/handleEmploymentLawQuestion.ts`. Synthesis is gated by retrieval; if there are no chunks, the answer is `insufficient_sources`.
6. **Never fabricate citations.** Every cited source must come from a real `legal_sources` / `legal_documents` / `legal_chunks` row. The citation gate enforces this.
7. **Never scrape uncontrolled.** Ingestion is from the curated source list in `apps/legal-orchestrator/src/ingestion/`. Each source has a fetch metadata audit row.
8. **No emojis, no emotional language, no apologies, no filler.** STRICT ENGINEERING MODE per `~/CLAUDE.md`.
9. **Truth protocol.** Every claim of completion needs evidence: exact file path, exact command run, exact output, git diff summary, verifier result. Otherwise state `NOT VERIFIED` or `NOT EXECUTED`.
10. **Active-vs-legacy naming.** Product name is **IterLaw**. The legacy name **RightsNow** must appear only inside material clearly marked legacy (`.github/workflows-disabled/`, `k8s/iterlaw-disabled-master-order/`, `docs/CRUSER_*`, or explicit `Legacy name:` markers). **OrdinoxAI** is the wider AI management platform — not this product.
11. **Canonical namespaces.** `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`. Legacy `iterlaw-data` may remain. Do not create a standalone `iterlaw` namespace.
12. **Canonical migration chain.** 000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 101 → 102. Do not apply `100_*`. New migrations are additive only — no DROP, DELETE, TRUNCATE, destructive ALTER.
13. **Run the verifiers before commit.** `verify-iterlaw-repo.sh`, `verify-iterlaw-rag-db.sh`, `verify-iterlaw-canonical-namespaces.sh`, and (if the backup surface is touched) `verify-iterlaw-backup.sh`. PR is not safe until all four are PASS / PARTIAL with only documented WARNs.
14. **Pre-push secret scan.** Shape-anchored regex only: `github_pat_`, `ghp_[A-Za-z0-9]{20,}`, `sk-[A-Za-z0-9]{48,}`, `sk-(proj|ant|svcacct)-[A-Za-z0-9_-]{20,}`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z_-]{35}`, `xox[bpoars]-…`, PEM private-key headers. Hits inside test regex literals or the verifier itself are allowed and explicitly excluded from the deny-list.
15. **`.claude/` and `iterlaw.code-workspace` are operator-local.** Both are in `.gitignore`. Never `git add` them.
