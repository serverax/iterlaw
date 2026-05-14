# Sprint 12M — Operator evidence refresh for G09 / G10 / G11

## Verdict: PARTIAL

Same operator-environment blockers as Sprint 12F / 12H / 12K. Re-probed today (2026-05-14). Docker Desktop daemon offline; SSH probe to `root@138.201.253.56` failed with a different exact error this time (`Connection timed out` rather than the prior classifier denial). **No gate flipped.**

## HEAD at sprint start

- `f757df3 docs(iterlaw): summarize sprint bundle 12k through 26 and update progress`

## Probe 1 — Docker

```text
$ docker version
 Git commit:        055a478
 Built:             Mon Apr 20 16:35:45 2026
 OS/Arch:           windows/amd64
 Context:           desktop-linux
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.

$ docker ps
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; ...
```

Daemon offline. `scripts/operator/sprint14-docker-staging-migration-replay.ps1` therefore not invoked.

**G09 stays NOT_VERIFIED.**

## Probe 2 — Read-only SSH

```text
$ ssh -o BatchMode=yes -o ConnectTimeout=10 root@138.201.253.56 "hostname && uptime"
ssh: connect to host 138.201.253.56 port 22: Connection timed out
```

This time the probe was permitted by the Claude Code classifier and reached the network layer but timed out at the TCP/22 connect. The host either does not respond on port 22 from this network, or the operator firewall blocks this workstation. Master IP `138.201.253.56` confirmed unchanged; deny-list `138.201.253.245` unchanged.

**G10 stays NOT_VERIFIED. G11 stays NOT_VERIFIED (tied to G10).**

## Operator action still required

| Gate | Action |
|---|---|
| G09 | Start Docker Desktop; set throwaway `ITERLAW_STAGING_PG_*` env vars; run Sprint 14 script. |
| G10 | From a workstation whose IP is allowlisted at the firewall, load an authorised SSH key and run Sprint 15 script. |
| G11 | Tied to G10. |

## Gate JSON

`PRODUCTION_READINESS_GATE.json` G09/G10/G11 blocker text refreshed to reference this report. G12 and G13 unchanged.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
- Exact error strings recorded above. No invented evidence.
