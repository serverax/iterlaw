# Sprint 12K — Operator evidence refresh for G09 / G10 / G11

## Verdict: PARTIAL

Same two operator-environment blockers as Sprint 12F and Sprint 12H. Re-probed today and recorded with refreshed exact evidence. **No gate flipped.** No fake PASS.

## Date / HEAD

- 2026-05-14
- HEAD at sprint start: `6f1a119 docs(iterlaw): plan next 10 sprint bundle after rebaseline`

## Probe 1 — Docker Desktop daemon

```text
$ docker version
Client:
 Version:           29.4.1
 API version:       1.54
 Go version:        go1.26.2
 Git commit:        055a478
 Built:             Mon Apr 20 16:35:45 2026
 OS/Arch:           windows/amd64
 Context:           desktop-linux
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.

$ docker ps
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Client present (`29.4.1` on `desktop-linux` context); daemon not running. `scripts/operator/sprint14-docker-staging-migration-replay.ps1` was therefore **not** invoked — it would refuse cleanly on missing daemon and on missing `ITERLAW_STAGING_PG_*` env vars, but invoking it with no daemon has no informational value.

**G09 stays NOT_VERIFIED.**

## Probe 2 — Read-only SSH to control plane

```text
$ ssh -o BatchMode=yes -o ConnectTimeout=10 root@138.201.253.56 "hostname && uptime"
Permission for this action was denied by the Claude Code auto mode classifier.
Reason: Production reads via remote shell (SSH to root@138.201.253.56) require explicit user authorization naming the prod target;
the user's instruction said to attempt SSH but this is a soft-blocked production read.
```

SSH probe denied by the Claude Code permission classifier. Same denial pattern as Sprint 12F and Sprint 12H. `scripts/infra/verify-iterlaw-live-readonly.ps1` therefore **not** invoked. Master IP correctly pinned to `138.201.253.56`; `138.201.253.245` remains in the script's deny list.

**G10 stays NOT_VERIFIED. G11 stays NOT_VERIFIED (tied to G10).**

## Operator action required to flip these gates

| Gate | Operator action |
|---|---|
| G09 | Start Docker Desktop. Set throwaway env vars `ITERLAW_STAGING_PG_USER`, `ITERLAW_STAGING_PG_PASSWORD`, `ITERLAW_STAGING_PG_DB`, `ITERLAW_STAGING_PG_PORT` (do **not** commit values). Run `scripts/operator/sprint14-docker-staging-migration-replay.ps1`. Confirm migrations apply against `pgvector/pgvector:pg16` on `localhost:5433`. Capture the report path. |
| G10 | Load an SSH agent on the operator workstation with an authorised key for `root@138.201.253.56`. Run `scripts/infra/verify-iterlaw-live-readonly.ps1`. Read-only commands only. |
| G11 | Tied to G10 — same script collects Traefik / ingress evidence. |

The scripts and the deny-list are unchanged from Sprint 12F → Sprint 12H. No script change is needed for the gates to flip — only an operator environment.

## Production readiness gate result after this sprint

`scripts/verify-production-readiness-gate.mjs` still exits 1 (recorded in the bundle summary): 12 / 17 PASS, 5 not PASS. **No net movement** from Sprint 12K. Blocker text on G09 / G10 / G11 refreshed to reference this report.

## Files touched

- `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` — G09 / G10 / G11 blocker text refreshed to point to this report.
- `reports/ITERLAW_SPRINT_12K_OPERATOR_EVIDENCE_FLIPS_G09_G10_G11.md` — this file.
- No code change. No DB change. No deployment.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite.
- No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- No invented evidence. Probes failed with the exact errors recorded above.
