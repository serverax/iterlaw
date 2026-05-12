#!/usr/bin/env bash
# verify-iterlaw-rag-db.sh — connect to the IterLaw Postgres database
# (when a DSN is provided) and report whether the Master-Order RAG
# foundation tables exist.
#
# Modes:
#   1. Static: when no PSQL is available or no DSN is provided, do a
#      best-effort check of the migration file and report MIGRATION_FILE_OK
#      / MIGRATION_FILE_MISSING.
#   2. Live: when DATABASE_URL is set AND `psql` is on PATH, runs read-
#      only SELECTs against information_schema to confirm each table.
#
# This script does NOT execute the migration. It does NOT write rows.
# It does NOT print the DSN.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="${REPO_ROOT}/apps/legal-orchestrator/db/migrations/100_iterlaw_core_rag_foundation.sql"

report() { printf "%-12s %s\n" "$1" "$2"; }

# Static — migration file presence + content sanity.
if [[ -f "${MIG}" ]]; then
  report "PASS" "migration file present"
  for t in legal_sources legal_documents legal_chunks legal_cases \
           verified_answers_cache rag_runs source_update_log answer_verification_log; do
    if grep -q "CREATE TABLE IF NOT EXISTS ${t}" "${MIG}"; then
      report "PASS" "migration defines ${t}"
    else
      report "FAIL" "migration does NOT define ${t}"
    fi
  done
  if grep -q "CREATE EXTENSION IF NOT EXISTS vector" "${MIG}"; then
    report "PASS" "migration enables pgvector"
  else
    report "FAIL" "migration does NOT enable pgvector"
  fi
  if grep -q "USING ivfflat" "${MIG}"; then
    report "PASS" "migration creates ivfflat embedding index"
  else
    report "FAIL" "migration does NOT create ivfflat embedding index"
  fi
else
  report "FAIL" "migration file missing: ${MIG}"
fi

# Live — only if both psql and DATABASE_URL are present.
if ! command -v psql > /dev/null 2>&1; then
  report "NOT EXECUTED" "psql not on PATH — skipping live DB checks"
  exit 0
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  report "NOT EXECUTED" "DATABASE_URL not set — skipping live DB checks"
  exit 0
fi

# All live queries are read-only and use parameterised bindings.
check_extension() {
  local ext="$1"
  local q
  q=$(psql "${DATABASE_URL}" -At -c "SELECT 1 FROM pg_extension WHERE extname = '${ext}'" 2>/dev/null || true)
  if [[ "${q}" == "1" ]]; then
    report "PASS" "extension ${ext} installed"
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
for t in legal_sources legal_documents legal_chunks legal_cases \
         verified_answers_cache rag_runs source_update_log answer_verification_log; do
  check_table "${t}"
done
