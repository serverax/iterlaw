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
M_102="${MIG_DIR}/102_add_legal_cases_table.sql"
M_104="${MIG_DIR}/104_user_workspace_foundation.sql"
M_105="${MIG_DIR}/105_case_workspace.sql"
M_106="${MIG_DIR}/106_enable_rls.sql"

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
  # 101 must NOT touch the 001-canonical tables. `legal_cases` is now
  # owned by 102_*, so 101 must not declare it either.
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
# 102_add_legal_cases_table.sql — checks.
# ---------------------------------------------------------------------
if [[ -f "${M_102}" ]]; then
  report "PASS" "102_add_legal_cases_table.sql present"

  if grep -qE "CREATE TABLE IF NOT EXISTS (public\\.)?legal_cases\\b" "${M_102}"; then
    report "PASS" "102_* defines legal_cases"
  else
    report "FAIL" "102_* missing CREATE TABLE legal_cases"
  fi

  # 102 must be additive only: no DROP / DELETE / TRUNCATE / destructive
  # ALTER. Comments are stripped first so a comment that *names* a
  # banned keyword does not trip the check.
  if grep -vE '^\s*--' "${M_102}" | grep -qiE '\b(DROP|TRUNCATE|DELETE)\b'; then
    report "FAIL" "102_* contains destructive SQL (DROP / TRUNCATE / DELETE)"
  else
    report "PASS" "102_* contains no destructive SQL"
  fi

  if grep -vE '^\s*--' "${M_102}" | grep -qiE '\bALTER TABLE\b.*\b(DROP|RENAME)\b'; then
    report "FAIL" "102_* contains destructive ALTER (DROP / RENAME)"
  else
    report "PASS" "102_* has no destructive ALTER"
  fi
else
  report "FAIL" "missing 102_add_legal_cases_table.sql"
fi

# ---------------------------------------------------------------------
# 104 / 105 / 106 — user-data + case-workspace + RLS block (static).
# ---------------------------------------------------------------------
for mig in "${M_104}" "${M_105}" "${M_106}"; do
  name=$(basename "${mig}")
  if [[ -f "${mig}" ]]; then
    report "PASS" "${name} present"
    if grep -vE '^\s*--' "${mig}" | grep -qiE '\b(DROP\s+(TABLE|COLUMN|INDEX|SCHEMA|EXTENSION)|TRUNCATE|DELETE\s+FROM)\b'; then
      report "FAIL" "  ${name} contains destructive SQL (DROP / TRUNCATE / DELETE)"
    else
      report "PASS" "  ${name} contains no destructive SQL"
    fi
    if grep -vE '^\s*--' "${mig}" | grep -qiE 'ALTER\s+TABLE[^\n]*\b(DROP|RENAME)\b'; then
      report "FAIL" "  ${name} contains destructive ALTER (DROP / RENAME)"
    else
      report "PASS" "  ${name} has no destructive ALTER"
    fi
    if grep -qE 'DATABASE_URL\s*=|\bfetch\s*\(|\bcurl\b|\bwget\b|postgres(ql)?://[^\s]+:[^\s]+@' "${mig}"; then
      report "FAIL" "  ${name} contains secrets / HTTP call"
    else
      report "PASS" "  ${name} carries no secrets / HTTP call"
    fi
  else
    report "FAIL" "missing ${name}"
  fi
done

# 106 — RLS surface checks (static).
if [[ -f "${M_106}" ]]; then
  if grep -E "^\s*ALTER\s+TABLE\s+public\\.(legal_sources|legal_documents|legal_chunks|legal_cases|legal_citations|legal_case_law|tribunal_decisions|rag_runs|rag_query_audit|answer_audit_log|verified_answers_cache|source_update_log|answer_verification_log)\b" "${M_106}" | grep -qE 'ENABLE\s+ROW\s+LEVEL\s+SECURITY'; then
    report "FAIL" "  106 wrongly enables RLS on a corpus table"
  else
    report "PASS" "  106 leaves corpus tables RLS-OFF"
  fi
  if grep -qF "ENABLE ROW LEVEL SECURITY" "${M_106}"; then
    report "PASS" "  106 enables RLS on user-data tables"
  else
    report "FAIL" "  106 does not enable RLS"
  fi
  if grep -qE "current_setting\('app\.user_id', true\)" "${M_106}"; then
    report "PASS" "  106 reads app.user_id GUC"
  else
    report "FAIL" "  106 missing app.user_id GUC reader"
  fi
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
# Additive table from 102.
check_table legal_cases

# Live-DB checks for the 104/105 tables (when DATABASE_URL + psql available).
for t in users workspaces workspace_members legal_case_records \
         legal_case_facts legal_case_documents legal_case_drafts \
         legal_case_timeline legal_case_sources; do
  check_table "${t}"
done
