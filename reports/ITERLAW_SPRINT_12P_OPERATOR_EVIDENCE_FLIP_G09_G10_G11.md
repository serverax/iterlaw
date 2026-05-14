# Sprint 12P — Operator evidence flip for G09 / G10 / G11

## Verdict: PARTIAL / NOT_VERIFIED

Non-mutating local-only evidence. Docker daemon still offline. SSH probes to **both** candidate hosts (`138.201.253.56` and `148.251.247.56`) explicitly NOT performed because the IterLaw live-host authority is unresolved between the repo (`138.201.253.56`) and the current OrdinoxAI K3s master note (`148.251.247.56`). **No gate flipped.**

## HEAD at sprint start

`a2d666f docs(iterlaw): summarize sprint bundle 12m through 34 and update progress`.

## Probe 1 — Docker daemon (local, non-mutating)

```text
$ docker version
 Version:           29.4.1
 API version:       1.54
 Go version:        go1.26.2
 Git commit:        055a478
 Built:             Mon Apr 20 16:35:45 2026
 OS/Arch:           windows/amd64
 Context:           desktop-linux
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Client present (`29.4.1` on `desktop-linux` context); daemon **not running**. `scripts/operator/sprint14-docker-staging-migration-replay.ps1` is therefore **not invoked**.

**G09 stays NOT_VERIFIED.**

## Probe 2 — SSH (intentionally NOT performed)

By operator instruction (Sprint 12P, Option C): **do not probe either candidate host**.

Host-truth conflict (evidence-grade):

| Source | IP | Status in repo |
|---|---|---|
| `scripts/infra/verify-iterlaw-live-readonly.ps1` (line 24) | `138.201.253.56` | pinned as `$expectedHost` |
| Authoritative live verifier deny-list (line 26) | `138.201.253.245` | **deny-listed, must not be used** |
| Current operator note (this session) | `148.251.247.56` | **0 occurrences across the repo** |

```text
$ grep -RIn "148\.251\.247\.56" .
(no matches)

$ grep -lRn "138\.201\.253\.56" . | head
scripts/infra/verify-iterlaw-live-readonly.ps1
docs/iterlaw/project/PRODUCTION_READINESS_GATE.md
docs/iterlaw/project/PRODUCTION_READINESS_GATE.json
docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md
... (17 files total, 51 occurrences)
```

Until a dedicated host-truth reconciliation sprint runs, the IterLaw live-readonly verifier remains pinned to `138.201.253.56` and **G10 / G11 stay NOT_VERIFIED**. The verifier script is **not** edited in this sprint.

## Gate JSON changes

- G09 blocker text refreshed to reference Sprint 12P (Docker daemon still offline).
- G10 blocker text refreshed to include the host-truth-unresolved note.
- G11 blocker text refreshed (tied to G10; host-truth note carried).
- G12 / G13 unchanged.

## New blocker recorded

> **Live host authority unresolved.** Repo pins IterLaw to `138.201.253.56`; current OrdinoxAI K3s master note says `148.251.247.56`. The IPs may name different systems, or IterLaw may not yet have been migrated. Requires a dedicated host-truth reconciliation sprint before SSH/live-gate flips. Until then, the IterLaw live-readonly verifier (`scripts/infra/verify-iterlaw-live-readonly.ps1`) is **NOT** edited and SSH probes are **NOT** performed.

## Operator action

Two operator-controlled prerequisites must be unblocked before G09 / G10 / G11 can flip:

1. **G09** — Start Docker Desktop on this workstation, set throwaway `ITERLAW_STAGING_PG_*` env vars (do not commit values), then run `scripts/operator/sprint14-docker-staging-migration-replay.ps1`.
2. **G10 / G11** — Confirm the authoritative IterLaw live host. Three honest options:
   - (a) IterLaw master has migrated to `148.251.247.56` → commit a reconciliation sprint that updates `verify-iterlaw-live-readonly.ps1`, the gate JSON blocker text, and the production-readiness gate doc, **then** run the verifier from an allowlisted workstation.
   - (b) IterLaw still uses `138.201.253.56` → verifier stays as-is; operator runs it from an allowlisted workstation.
   - (c) IterLaw is mid-migration → stay NOT_VERIFIED until decided.

This sprint represents option (c) explicitly.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- **No SSH probe to either `138.201.253.56` or `148.251.247.56`.**
- No edit to `scripts/infra/verify-iterlaw-live-readonly.ps1`. The verifier stays pinned to `138.201.253.56`.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- No invented evidence. Probe failure mode for Docker recorded verbatim.
