#!/usr/bin/env bash
###############################################################################
# COMPREHENSIVE QA AUDIT: IterLaw Sprints 0-39
#
# Evidence-oriented audit script.
# Output: reports/COMPREHENSIVE_QA_AUDIT_SPRINTS_0_39.md
#
# This script intentionally does not auto-commit, push, or write a production
# readiness verdict. The auditor must assign the verdict from the evidence.
###############################################################################

set +e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

AUDIT_FILE="reports/COMPREHENSIVE_QA_AUDIT_SPRINTS_0_39.md"
mkdir -p reports tmp

append() {
  printf '%s\n' "$*" >> "$AUDIT_FILE"
}

append_cmd() {
  local title="$1"
  shift
  append "### $title"
  append '```text'
  "$@" >> "$AUDIT_FILE" 2>&1
  local exit_code=$?
  append '```'
  append ""
  append "**Exit code:** $exit_code"
  append ""
  return 0
}

count_cmd() {
  local title="$1"
  shift
  local value
  value="$("$@" 2>/dev/null)"
  append "| $title | ${value:-0} |"
}

: > "$AUDIT_FILE"

append "# Comprehensive QA Audit: IterLaw Sprints 0-39"
append ""
append "**Date (UTC):** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
append "**Auditor script:** \`scripts/comprehensive-qa-audit.sh\`"
append "**Mode:** evidence capture only"
append ""
append "---"
append ""

append "## 1. Inventory"
append ""
append "| Metric | Value |"
append "|---|---:|"
count_cmd "Tracked/unignored files excluding vendor/generated folders" bash -lc "rg --files -g '!node_modules' -g '!apps/web/.next' -g '!reports' -g '!tmp' | wc -l"
count_cmd "Test files" bash -lc "rg --files -g '!node_modules' -g '!apps/web/.next' -g '*.test.ts' -g '*.test.tsx' -g '*.spec.ts' -g '*.spec.tsx' | wc -l"
count_cmd "Legal-orchestrator up migrations" bash -lc "find apps/legal-orchestrator/db/migrations -maxdepth 1 -name '*.sql' ! -name '*.down.sql' | wc -l"
count_cmd "Legal-orchestrator down migrations" bash -lc "find apps/legal-orchestrator/db/migrations -maxdepth 1 -name '*.down.sql' | wc -l"
count_cmd "Sprint-complete tags" bash -lc "git tag -l | grep -cE '^sprint-[0-9]+-complete$'"
append ""

append "### HEAD"
append '```text'
git log --oneline -1 >> "$AUDIT_FILE" 2>&1
append '```'
append ""

append "### Sprint Tags"
append '```text'
git tag -l | grep -E '^sprint-[0-9]+-complete$' | sort -V >> "$AUDIT_FILE" 2>&1
append '```'
append ""

append "## 2. Migration Safety"
append ""
append "### Up migrations lacking matching down migrations"
append '```text'
for up in apps/legal-orchestrator/db/migrations/*.sql; do
  case "$up" in
    *.down.sql) continue ;;
  esac
  down="${up%.sql}.down.sql"
  test -f "$down" || basename "$up"
done >> "$AUDIT_FILE" 2>&1
append '```'
append ""

append "| Static SQL signal | Count |"
append "|---|---:|"
count_cmd "ENABLE ROW LEVEL SECURITY" bash -lc "grep -R \"ENABLE ROW LEVEL SECURITY\" apps/legal-orchestrator/db/migrations/*.sql | wc -l"
count_cmd "CREATE POLICY" bash -lc "grep -R \"CREATE POLICY\" apps/legal-orchestrator/db/migrations/*.sql | wc -l"
count_cmd "REFERENCES" bash -lc "grep -R \"REFERENCES\" apps/legal-orchestrator/db/migrations/*.sql | wc -l"
count_cmd "CREATE INDEX" bash -lc "grep -R \"CREATE INDEX\" apps/legal-orchestrator/db/migrations/*.sql | wc -l"
append ""

append "## 3. Build And Test Gates"
append ""
append_cmd "Root lint" npm run lint
append_cmd "Root typecheck" npm run typecheck
append_cmd "Root Jest" npm run test -- --runInBand
append_cmd "Root build" npm run build
append_cmd "Legal-orchestrator typecheck" bash -lc "cd apps/legal-orchestrator && npm run typecheck"
append_cmd "Legal-orchestrator tests" bash -lc "cd apps/legal-orchestrator && npm run test"
append_cmd "Legal-orchestrator build" bash -lc "cd apps/legal-orchestrator && npm run build"
append_cmd "Backend typecheck" bash -lc "cd backend && npm run typecheck"
append_cmd "Backend build" bash -lc "cd backend && npm run build"
append_cmd "Backend Phase 1 E2E" bash -lc "cd backend && npm run test:phase1"
append_cmd "API typecheck" bash -lc "cd api && npm run typecheck"
append_cmd "API build" bash -lc "cd api && npm run build"
append_cmd "AI orchestrator typecheck" bash -lc "cd apps/ai-orchestrator && npm run typecheck"
append_cmd "AI orchestrator tests" bash -lc "cd apps/ai-orchestrator && npm run test"
append_cmd "Synthesis worker typecheck" bash -lc "cd apps/synthesis-worker && npm run typecheck"
append_cmd "Synthesis worker build" bash -lc "cd apps/synthesis-worker && npm run build"
append_cmd "Synthesis worker tests" bash -lc "cd apps/synthesis-worker && npm run test"

append "## 4. Security And Quality Scans"
append ""
append "| Check | Count |"
append "|---|---:|"
count_cmd "Secret-shaped concrete credential hits" bash -lc "rg -n '(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{20,}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----|postgres://[^[:space:]<>\"'\"'\"']+:[^[:space:]<>\"'\"'\"']+@)' -g '!node_modules' -g '!apps/web/.next' -g '!reports' -g '!tmp' -g '!package-lock.json' | wc -l"
count_cmd "TODO/FIXME/XXX in legal-orchestrator source" bash -lc "rg -n 'TODO|FIXME|XXX' apps/legal-orchestrator/src -g '*.ts' | wc -l"
count_cmd "console.* outside legal-orchestrator tests/loggers" bash -lc "rg -n 'console\\.' apps/legal-orchestrator/src -g '*.ts' | rg -v '(test\\.ts|src/utils/jsonLog\\.ts|src/utils/logger\\.ts|//.*console)' | wc -l"
count_cmd ".skip/.only in legal-orchestrator tests" bash -lc "rg -n '(\\.skip\\(|\\.only\\(|test\\.skip|describe\\.skip|it\\.skip)' apps/legal-orchestrator/src -g '*.ts' | wc -l"
append ""

append_cmd "Root npm audit" npm audit
append_cmd "Legal-orchestrator npm audit" bash -lc "cd apps/legal-orchestrator && npm audit"
append_cmd "PowerShell smoke script" powershell -ExecutionPolicy Bypass -File scripts/smoke/iterlaw-mvp-smoke.ps1

append "## 5. Git Hygiene"
append ""
append_cmd "Git status" git status --short --branch

append "---"
append ""
append "## Verdict"
append ""
append "Evidence capture complete. Auditor must append the final verdict."

echo "Audit evidence captured to: $AUDIT_FILE"
