# IterLaw — Operations Rules

Standing rules for every agent (Claude Code, Cursor, future AIAs) and every operator workflow.

## Never (unless explicitly authorised in the same instruction)

- `git push` — keep work local until the operator says push.
- `kubectl apply` / `kubectl delete` / `kubectl patch` / `kubectl edit` / `kubectl scale` / `kubectl drain` / `kubectl rollout` — every cluster-mutating verb.
- `helm install` / `helm upgrade`.
- `psql` against the production database.
- Production DB writes of any kind.
- Creating real secrets / private keys / API keys in the repo.
- Printing secret values in chat, logs, reports, or commits.
- Calling external LLMs from the orchestrator request path.
- Adding scripts that hit unpinned remote URLs at apply time.
- Renaming IterLaw or the canonical namespaces.
- Re-introducing `RightsNow` to active code, config, or docs.
- Creating `iterlaw-prod` or bare `iterlaw` namespace.

## Always

- Treat staging as a hard gate before production.
- Take a `pg_dump --format=custom` snapshot before applying any DB migration on a dev / staging DB.
- Apply migrations with `psql -v ON_ERROR_STOP=1` so partial application is impossible.
- Run `bash scripts/infra/verify-iterlaw-rag-db.sh` after a live apply; expect previously `NOT EXECUTED` checks to flip to PASS.
- Run the RLS staging test plan (Appendix C of `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md`) before declaring user-data tables production-ready.
- Pin container images to `@sha256:` digests for production. Local-dev tags only in dev.
- Pin the Hetzner Storage Box `/32` CIDR in `k8s/iterlaw-data/backups/upload-networkpolicy.yaml` before applying.

## Migration apply policy

- **Dev / staging first.** The operator close-out checklists assume a non-production target; the production-host fragment guard in step 0 refuses production.
- **Reverse-order rollback** when something fails (see each migration's `.down.sql`).
- Rollback **must be tested in staging** before the migration is applied in production.
- After a successful staging apply, the operator runs the SQL verification queries in Appendix B and the RLS test plan in Appendix C.

## What every agent report must end with

The following lines must appear (verbatim where applicable) at the end of any QA / sprint / engineering report:

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.

If the agent did perform any of these (because the operator authorised it in the same instruction), it must be stated explicitly and the evidence captured (`kubectl apply --dry-run=server -f ...`, etc.).

## Push policy

- A branch may sit local-ahead of `origin/master` indefinitely. That is the safe default.
- The operator initiates pushes. The agent never auto-pushes after a green build.
- Force-push is forbidden against `master` / `main`. Other branches require explicit instruction.
- Pre-push secret scan: shape-anchored regex against `github_pat_`, `ghp_`, `sk-…`, `AKIA…`, `AIza…`, PEM headers. Hits inside test regex literals / verifier deny-lists are allowed; hits anywhere else block the push.

## Cluster context hygiene

- Confirm `kubectl config current-context` before any cluster-touching command, even read-only ones.
- `aks-iterlaw-we-prod` and any other production context is **read-only by default**; even `kubectl get` requires explicit authorisation with the namespace scope confirmed.
- Recommended: maintain a non-prod context (e.g. `k3d-iterlaw-local`) for routine review work.

## Failure-mode etiquette

- Investigate root cause before bypassing safety checks (`--no-verify`, `--force`, `--insecure-skip-tls-verify`, etc.).
- Report `NOT EXECUTED` honestly when a command cannot run safely.
- Mark unknown items `NOT VERIFIED`, never invent a PASS.
- When a queued user task conflicts with a locked decision (e.g. "use migration 102 for user data" vs the shipped corpus `102`), surface the conflict and ask, do not silently override.
