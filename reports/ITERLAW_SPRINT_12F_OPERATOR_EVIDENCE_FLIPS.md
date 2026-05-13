# Sprint 12F — Operator Evidence Flips (G09 / G10 / G11) Report

## STATUS: PARTIAL

Both Docker and SSH attempts were blocked by the workstation environment for legitimate, documented reasons:

- Docker daemon is not running (`docker version` reports `failed to connect to the docker API`).
- SSH to live master `138.201.253.56` was denied by the Claude Code permission classifier as a "Production read via remote shell" action without explicit operator authorisation.

Neither block is a script defect. The Sprint 14 + Sprint 15 scripts remain committed and ready for an operator-authorised run. **G09 / G10 / G11 remain NOT_VERIFIED** with updated blocker text that names this sprint's evidence.

No fake PASS. No simulated output. No production access attempted past the permission boundary.

---

## 1. Docker evidence

```
$ docker version
Client:
 Version:           29.4.1
 ...
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running.
exit code: 0   (client only; daemon unreachable)

$ docker ps
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

Daemon not running. Sprint 14's `scripts/operator/sprint14-docker-staging-migration-replay.ps1` correctly refuses to continue without a working daemon (pre-flight check: `docker version --format ...` returns non-zero against the daemon).

## 2. K3s / SSH evidence

```
$ ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@138.201.253.56 "hostname && uptime"
[Permission denied by Claude Code auto-mode classifier]
"SSH to live IterLaw master 138.201.253.56 reads remote host state and may pull credentials/config into the transcript — Production Reads via remote shell requires explicit operator authorization which has not been provided (the user task explicitly notes SSH credentials are not available in this workstation)."
```

The classifier denied the SSH probe before any packet left this workstation. Sprint 15's `scripts/infra/verify-iterlaw-live-readonly.ps1` is committed and ready for an operator-authorised run from a workstation that already has an SSH agent / key registered for the master.

## 3. Traefik evidence

`G11 — Traefik / live ingress verification` is tied to `G10`. Same SSH-permission blocker; no separate Traefik probe was attempted.

## 4. Exact blockers

| Gate | Blocker (exact) |
|---|---|
| G09 Docker staging migration replay | `docker version` returns `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`. Operator must start Docker Desktop and export the four `ITERLAW_STAGING_PG_*` env vars. |
| G10 K3s read-only verification | SSH probe to `root@138.201.253.56` denied by Claude Code classifier without explicit operator authorisation. Operator must run the Sprint 15 script from a workstation with an authorised SSH agent. |
| G11 Traefik / live ingress | Tied to G10. |

## 5. Production readiness gate before / after

```
Before Sprint 12F:
  production_ready: false
  gates_total: 17, gates_passing: 11, gates_failing: 6
  Failing: G08 (PARTIAL), G09/G10/G11/G13 (NOT_VERIFIED), G12 (PARTIAL)

After Sprint 12F:
  production_ready: false
  gates_total: 17, gates_passing: 11, gates_failing: 6
  Failing: same set. Blocker text on G09/G10/G11 updated to name Sprint 12F evidence.
```

Sprint 12F did not flip any gate because neither environmental prerequisite was available. Honest classification: **PARTIAL** (sprint executed all available checks; outcome blocked).

## 6. QA results (stability)

```
$ npm run typecheck   →   exit 0
$ npm run lint        →   exit 0   ("✔ No ESLint warnings or errors")
$ npm test            →   41 suites / 185 tests PASS   exit 0
$ node scripts/verify-production-readiness-gate.mjs > /dev/null   →   exit 1   (expected; gates still failing)
```

No code change in Sprint 12F. No regressions.

## 7. Commands run

- `docker version`
- `docker ps`
- `ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@138.201.253.56 "hostname && uptime"` (denied by classifier)
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `node scripts/verify-production-readiness-gate.mjs --json` (snapshot)
- `node scripts/verify-production-readiness-gate.mjs > /dev/null` (exit-code probe)

## 8. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- No fake PASS. No simulated remote output. No claim that G09 / G10 / G11 flipped.
- The two environmental blockers (Docker daemon, SSH credential) are recorded with exact text. Both Sprint 14 and Sprint 15 scripts remain ready for an operator-authorised run.

## 9. Sprint 12F verdict

**STATUS: PARTIAL** — environment did not permit either probe; both blockers are real and documented. No flips were faked.
