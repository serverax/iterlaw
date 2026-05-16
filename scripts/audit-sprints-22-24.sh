#!/bin/bash
# QA audit script for Sprints 22-24 (Law Module Engine Phase 2/3/4).
# Read-only. Captures evidence used by reports/QA_AUDIT_SPRINTS_22_24.md.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== QA AUDIT: SPRINTS 22-24 ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Root: $ROOT"
echo

# 1. GIT INTEGRITY
echo "[1/10] Git Integrity Check"
git log --oneline sprint-21-complete..sprint-24-complete | head -20
echo "Tags:"
git tag -l | grep -E "^sprint-2[234]-complete$"
echo

# 2. TYPECHECK & BUILD
echo "[2/10] TypeCheck & Build (apps/legal-orchestrator)"
( cd apps/legal-orchestrator && npm run typecheck 2>&1 | tail -5 )
( cd apps/legal-orchestrator && npm run build 2>&1 | tail -5 )
echo

# 3. TEST EXECUTION
echo "[3/10] Full Vitest Suite (apps/legal-orchestrator)"
( cd apps/legal-orchestrator && npm test 2>&1 | grep -E "Test Files|Tests" | tail -5 )
echo

# 4. MIGRATION SCHEMA VALIDATION
echo "[4/10] Migration Integrity"
for mig in 118 119 120; do
  echo "Migration $mig:"
  wc -l apps/legal-orchestrator/db/migrations/${mig}_*.sql 2>/dev/null
  echo -n "  CREATE/ALTER TABLE count: "
  grep -cE "CREATE TABLE|ALTER TABLE" apps/legal-orchestrator/db/migrations/${mig}_*.sql 2>/dev/null | head -1
  echo -n "  ENABLE ROW LEVEL SECURITY count: "
  grep -c "ENABLE ROW LEVEL SECURITY" apps/legal-orchestrator/db/migrations/${mig}_*.sql 2>/dev/null | head -1
  if ls apps/legal-orchestrator/db/migrations/${mig}_*.down.sql >/dev/null 2>&1; then
    echo "  Down migration: PRESENT"
  else
    echo "  Down migration: MISSING"
  fi
done
echo

# 5. CODE STRUCTURE
echo "[5/10] Code Structure & Exports"
echo "lawEnginePhase files:"
wc -l apps/legal-orchestrator/src/coherentSystem/lawEnginePhase*.ts 2>/dev/null
echo "index.ts exports:"
grep -E "^export.*lawEnginePhase|^export.*zone2|^export\s+const\s+lawEnginePhase" apps/legal-orchestrator/src/coherentSystem/index.ts | head -20
echo

# 6. TEST COVERAGE
echo "[6/10] Test File Sizes"
for sprint in 22 23 24; do
  echo "Sprint $sprint:"
  wc -l apps/legal-orchestrator/src/tests/sprint${sprint}LawEnginePhase*.test.ts 2>/dev/null
done
echo

# 7. ZONE 2 STUB VALIDATION
echo "[7/10] Zone 2 Stub Methods"
echo -n "zone2LawStub.ts async/export count: "
grep -cE "async|export" apps/legal-orchestrator/src/coherentSystem/zone2LawStub.ts
echo -n "zone2LawTypes.ts interface/type count: "
grep -cE "^(export\s+)?(interface|type)\s" apps/legal-orchestrator/src/coherentSystem/zone2LawTypes.ts
echo

# 8. RLS POLICIES
echo "[8/10] RLS Policies Count (118/119/120)"
echo -n "ENABLE ROW LEVEL SECURITY across new migrations: "
grep -cR "ENABLE ROW LEVEL SECURITY" \
  apps/legal-orchestrator/db/migrations/118_*.sql \
  apps/legal-orchestrator/db/migrations/119_*.sql \
  apps/legal-orchestrator/db/migrations/120_*.sql 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'
echo -n "CREATE POLICY across new migrations: "
grep -cR "CREATE POLICY" \
  apps/legal-orchestrator/db/migrations/118_*.sql \
  apps/legal-orchestrator/db/migrations/119_*.sql \
  apps/legal-orchestrator/db/migrations/120_*.sql 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'
echo

# 9. NO SECRETS
echo "[9/10] Hardcoded Secrets Check"
echo -n "non-comment secret-shape lines in lawEnginePhase*.ts: "
grep -nE "(password|secret|apiKey|api_key)\s*[=:]\s*[\"']" apps/legal-orchestrator/src/coherentSystem/lawEnginePhase*.ts 2>/dev/null | grep -vE "^\s*//" | wc -l
echo -n "console.log in lawEnginePhase*.ts + zone2*.ts: "
grep -cE "console\." apps/legal-orchestrator/src/coherentSystem/lawEnginePhase*.ts apps/legal-orchestrator/src/coherentSystem/zone2*.ts 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}'
echo

# 10. REPORT FILES
echo "[10/10] Sprint Reports"
ls -lah reports/ITERLAW_SPRINT_22_LAW_MODULE_ENGINE_PHASE2.md \
        reports/ITERLAW_SPRINT_23_LAW_MODULE_ENGINE_PHASE3.md \
        reports/ITERLAW_SPRINT_24_LAW_MODULE_ENGINE_PHASE4.md 2>&1
wc -l   reports/ITERLAW_SPRINT_22_LAW_MODULE_ENGINE_PHASE2.md \
        reports/ITERLAW_SPRINT_23_LAW_MODULE_ENGINE_PHASE3.md \
        reports/ITERLAW_SPRINT_24_LAW_MODULE_ENGINE_PHASE4.md 2>/dev/null
echo

echo "=== AUDIT SCRIPT COMPLETE ==="
