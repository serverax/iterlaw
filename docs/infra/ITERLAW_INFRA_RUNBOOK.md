# IterLaw — Infrastructure Runbook

This runbook is the top-level entry point for operating IterLaw infrastructure.
For deeper specifics, follow the cross-references at the foot of each section.

## Workload map

```
                                            +-----------------+
                                            | iterlaw-web     |
                                            |  (Next.js)      |
                                            +--------+--------+
                                                     |
                                                     |  HTTP :3012
                                                     v
                                            +-----------------+
                                            | legal-orchestr. |
                                            |  /api/legal/ask |
                                            +--------+--------+
                                                     |
                                       Redis Streams |
                                                     v
                                            +-----------------+
                                            | synthesis-redis |
                                            |  (StatefulSet)  |
                                            +--------+--------+
                                                     ^
                                                     | Redis Streams
                                                     |
                                            +-----------------+
                                            | synthesis-worker|
                                            |  MODEL_MODE     |
                                            +-----------------+
```

Application workloads live in namespace `iterlaw-ai`. PostgreSQL lives
in the dedicated namespace `iterlaw-data` (StatefulSet + nightly backup
CronJob). For synthesis, the worker temporarily calls the pre-existing
Ollama service in the unrelated `ordinox-ai` namespace; that is the only
permitted cross-namespace LLM hop.

## Required reading before any deploy

1. `infra/iterlaw/naming-contract.md`
2. `infra/iterlaw/environment-contract.md`
3. `infra/iterlaw/secrets-contract.md`
4. `infra/iterlaw/deployment-contract.md`
5. `infra/iterlaw/wasm-contract.md`
6. `infra/iterlaw/synthesis-llm-contract.md`
7. `infra/iterlaw/database-contract.md`

## Day-1 deploy

1. **Static verify.** `bash scripts/infra/verify-iterlaw-repo.sh`
2. **Build images.** `bash scripts/infra/build-iterlaw-images.sh`
3. **Load into K3s.** `bash scripts/infra/load-iterlaw-images-k3s.sh`
4. **Seal secrets.** See `ITERLAW_SECRETS_RUNBOOK.md`.
5. **Apply manifests.** `bash scripts/infra/deploy-iterlaw-k3s.sh --apply`
6. **Cluster verify.** `bash scripts/infra/verify-iterlaw-cluster.sh`

## Day-2 changes

- Manifest changes go through the static verifier in CI.
- Image rebuilds repeat steps 2–3 above; manifests stay untouched unless
  env-contract changes (which must be reflected in the contract doc).

## Incident triage

| Symptom                                | Probable cause                                                | First step                                                  |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `/ready` returns 503                   | Redis offline or DB DSN broken                                | `kubectl -n iterlaw-ai logs deploy/legal-orchestrator`      |
| Synthesis responses missing            | `synthesis-worker` in `MODEL_MODE=disabled` or stalled        | `kubectl -n iterlaw-ai logs deploy/synthesis-worker`        |
| Audit shows `backend: "fallback_ts"`   | `.wasm` binary absent in the `iterlaw-wasm-rule-runner` CM    | Expected when no binary is shipped — see `ITERLAW_WASM_INFRA.md` |
| `external_llm_used=true` anywhere      | **Contract breach.** Halt and review the offending commit.    | Revert and post-mortem.                                     |

## Rollback

`bash scripts/infra/rollback-iterlaw-k3s.sh` reverts the three Deployments
via `kubectl rollout undo`. Redis must be rolled back manually with care to
preserve stream state.
