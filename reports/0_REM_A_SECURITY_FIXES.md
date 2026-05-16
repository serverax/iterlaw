# Sprint 0-Rem-A: Security Fixes

## Summary

- **Vulnerabilities Before:** 7 total: 4 low, 3 high, 0 critical
- **Vulnerabilities After:** 0
- **Status:** PASS

## Packages Updated

- Root `jest-environment-jsdom`: `^29.7.0` -> `^30.4.1`
- Web `eslint-config-next`: `^14.2.18` -> `^15.5.18`
- Root `package-lock.json` refreshed for patched transitive dependencies

## Vulnerability Paths Resolved

- `eslint-config-next` / `@next/eslint-plugin-next` / vulnerable `glob`
- `jest-environment-jsdom` / `jsdom` / `http-proxy-agent` / vulnerable `@tootallnate/once`

## Breaking Changes

- No application breakage observed in local verification.
- `jest-environment-jsdom` moved to the 30.x line while root Jest remains 29.x; the full root Jest suite passed after the update.

## Tests

- Root audit: PASS, `found 0 vulnerabilities`
- Root Jest: PASS, 48 suites / 221 tests
- Root lint: PASS, no ESLint warnings/errors
- Root build: PASS
- Legal-orchestrator typecheck: PASS
- Legal-orchestrator tests: PASS, 136 files / 3,012 tests
- API typecheck: PASS
- API tests: NOT RUN, `@iterlaw/api` has no `test` script

## Notes

Legal-orchestrator test count includes unrelated Sprint 40-44 working-tree tests present during this remediation branch. No Sprint 40-44 source files were staged for this remediation.

## Sign-Off

Complete.
