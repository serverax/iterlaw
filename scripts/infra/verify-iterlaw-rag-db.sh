#!/usr/bin/env bash
# verify-iterlaw-rag-db.sh — repo-level checks on the IterLaw RAG
# migration set, plus optional live-DB checks if both `psql` and
# DATABASE_URL are available.
#
# Reports: PASS / FAIL / WARN / NOT EXECUTED. Never opens a DB
# connection without an explicit DATABASE_URL. Never prints the DSN.
#
# After the 0ad96ab → 101 reconciliation, the canonical state is:
#   * 000_pgvector_prerequisite.sql + 001_legal_rag_foundation.sql are
#     the canonical foundation.
#   * 002–010 build on 001.
#   * 100_iterlaw_core_rag_foundation.sql is DRAFT and MUST NOT apply.
#   * 101_reconcile_legal_rag_schema.sql is the additive reconciliation.
#
# See docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG_DIR="${REPO_ROOT}/apps/legal-orchestrator/db/migrations"
CANONICAL_DOC="${REPO_ROOT}/docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md"
M_001="${MIG_DIR}/001_legal_rag_foundation.sql"
M_100="${MIG_DIR}/100_iterlaw_core_rag_foundation.sql"
M_101="${MIG_DIR}/101_reconcile_legal_rag_schema.sql"

report() { printf "%-12s %s\n" "$1" "$2"; }

# ---------------------------------------------------------------------
# Static repo checks.
# ---------------------------------------------------------------------

if [[ -f "${CANONICAL_DOC}" ]]; then
  report "PASS" "canonical decision doc present"
else
  report "FAIL" "missing docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md"
fi

if [[ -f "${M_001}" ]]; then
  report "PASS" "001_legal_rag_foundation.sql present (canonical)"
else
  report "FAIL" "missing 001_legal_rag_foundation.sql"
fi

if [[ -f "${M_100}" ]]; then
  if grep -q "DO NOT APPLY" "${M_100}"; then
    report "PASS" "100_iterlaw_core_rag_foundation.sql carries DO-NOT-APPLY banner"
  else
    report "FAIL" "100_iterlaw_core_rag_foundation.sql missing DO-NOT-APPLY banner — schema conflict risk"
  fi
fi

if [[ -f "${M_101}" ]]; then
  report "PASS" "101_reconcile_legal_rag_schema.sql present"
  for t in verified_answers_cache rag_runs source_update_log answer_verification_log; do
    if grep -q "CREATE TABLE IF NOT EXISTS ${t}" "${M_101}"; then
      report "PASS" "101_* defines ${t}"
    else
      report "FAIL" "101_* missing ${t}"
    fi
  done
  # 101 must NOT touch the 001-canonical tables.
  for t in legal_sources legal_documents legal_chunks legal_cases; do
    if grep -qE "CREATE TABLE IF NOT EXISTS ${t}\\b" "${M_101}"; then
      report "FAIL" "101_* redefines canonical table ${t} — must be additive only"
    fi
    if grep -qE "(DROP|ALTER) TABLE.*\\b${t}\\b" "${M_101}"; then
      report "FAIL" "101_* mutates canonical table ${t} — additive only"
    fi
  done
  report "PASS" "101_* leaves 001-canonical tables untouched"
else
  report "FAIL" "missing 101_reconcile_legal_rag_schema.sql"
fi

# ---------------------------------------------------------------------
# Live DB checks (best effort).
# ---------------------------------------------------------------------

if ! command -v psql > /dev/null 2>&1; then
  report "NOT EXECUTED" "psql not on PATH — skipping live DB checks"
  exit 0
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  report "NOT EXECUTED" "DATABASE_URL not set — skipping live DB checks"
  exit 0
fi

check_extension() {
  local ext="$1"
  local q
  q=$(psql "${DATABASE_URL}" -At -c "SELECT 1 FROM pg_extension WHERE extname = '${ext}'" 2>/dev/null || true)
  if [[ "${q}" == "1" ]]; then
    report "PASS" "extension ${ext}"
  else
    report "FAIL" "extension ${ext} NOT installed"
  fi
}

check_table() {
  local table="$1"
  local q
  q=$(psql "${DATABASE_URL}" -At -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'" 2>/dev/null || true)
  if [[ "${q}" == "1" ]]; then
    report "PASS" "table public.${table}"
  else
    report "NOT DEPLOYED" "table public.${table}"
  fi
}

check_extension pgcrypto
check_extension vector
# Canonical tables from 001.
for t in legal_sources legal_documents legal_chunks legal_citations \
         legal_case_law tribunal_decisions; do
  check_table "${t}"
done
# Additive tables from 101.
for t in verified_answers_cache rag_runs source_update_log answer_verification_log; do
  check_table "${t}"
done
