# IterLaw Agent Security Boundaries

**Status:** Active boundary specification (documentation only; no enforcement code added by this doc).
**Scope:** Every IterLaw AI agent, every coding-automation agent (Claude Code, Cursor, OpenHands), every workflow agent (LangGraph, CrewAI, Dify, n8n), and every script that calls a model on behalf of an agent.
**Authority:** These boundaries override agent prompts, tool definitions, and model-level instructions.
**Last updated:** 2026-05-13.

Companion documents:

- Operating model: [`../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md`](../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md).
- Hard rules: [`../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`](../project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md).
- Sprint plan: [`../project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md`](../project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md).
- Before / after architecture: [`../architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md`](../architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md).

---

## 1. Principles

1. **No mutation first.** Read-only checks come before any change. Discovery is the default operating mode.
2. **Classify before changing.** Every port, service, namespace, manifest, secret, and policy must be classified before any agent proposes a change.
3. **Unknown ⇒ do not touch.** Anything not explicitly classified is `UNKNOWN_DO_NOT_TOUCH`.
4. **Preserve operational reachability.** SSH and the existing operational stack stay reachable.
5. **Repo sandbox first.** Agents work in a feature branch in this repository before any server access is considered.
6. **Human approval before merge or deploy.** No agent merges to `master`. No agent deploys.

---

## 2. SSH and remote access

- SSH must **not** be blocked.
- SSH ports must **not** be closed by any agent.
- Agent-driven discovery may **read** the SSH configuration but must **not** modify it.
- Key rotation, key removal, and authorized-key changes are **human-only** operations.
- No agent may execute `iptables`, `ufw`, `firewalld`, `nft`, `netsh advfirewall`, or equivalent commands against any host.

If an agent's automation appears to require an SSH config change, the action is suspended and routed to the human operator.

---

## 3. Existing ports and services (must be preserved)

The following are **protected** — agents may neither close, redirect, rewrite, proxy-strip, nor TLS-downgrade them. Any change to them requires explicit human approval and a classified discovery report.

- **K3s** API server (typically 6443) and node/agent ports.
- **Traefik** ingress (HTTP, HTTPS, dashboard if exposed).
- **cert-manager** webhook and controller endpoints.
- **Ollama** local inference port (default 11434) — local-only by policy.
- **PostgreSQL** (5432) — including the operator workstation DB used by Track B backup scripts.
- **Redis / NATS** ports used by the orchestrator and ingestion services.
- **Monitoring** endpoints (Prometheus / scrape endpoints / dashboard ports) currently in use by the operator.
- SSH (typically 22 or the operator-set port).

Agents must not assume a port is unused. The default classification is `PROTECTED_UNTIL_PROVED_OTHERWISE`.

---

## 4. Discovery-before-hardening flow

```
Discover (read-only)
  → Classify (KNOWN / PROTECTED / UNKNOWN_DO_NOT_TOUCH)
  → Propose (text-only proposal with reason codes)
  → Human review
  → Human approval
  → Operator-executed change (not agent-executed)
  → Re-discover (read-only) to verify the change
```

No step is skipped. A "quick fix" or "emergency tighten" by an agent is not permitted.

---

## 5. Port and service classification

| Classification | Meaning | Agent permission |
|---|---|---|
| `KNOWN_PROTECTED` | Confirmed part of the IterLaw stack (K3s, Traefik, cert-manager, Ollama, Postgres, Redis/NATS, SSH, monitoring). | Read only. No mutation. |
| `KNOWN_NON_CRITICAL` | Confirmed non-critical and approved for change by a human. | Read; proposals only. No direct mutation. |
| `UNKNOWN_DO_NOT_TOUCH` | Not yet classified. | Read only. No mutation. Surface as discovery finding. |
| `EXPECTED_CLOSED` | Confirmed closed and expected to remain closed. | Read only. No mutation. |

A change to any classification is itself an action that requires human approval.

---

## 6. K3s, Traefik, cert-manager, Ollama, Postgres, Redis/NATS

- Read access is **discovery only** in non-production contexts. Production read access requires a human-issued, scoped credential.
- Agents may **not** apply manifests.
- Agents may **not** delete pods, services, ingresses, secrets, configmaps, or PVCs.
- Agents may **not** alter Traefik routes or cert-manager issuers.
- Agents may **not** pull, mount, or expose Ollama models beyond the local node policy.
- Agents may **not** run DDL against PostgreSQL in production. Migrations are operator-driven per the Sprint 10 / Sprint 12 / Sprint 13 runbooks.
- Agents may **not** flush Redis or purge NATS subjects.

---

## 7. Production secrets

- Production secrets are **never** placed into agent prompts.
- Agents read **non-secret** configuration only.
- Agents must **not** print, log, echo, transmit, base64-decode, or write secret values to disk.
- If an agent discovers a secret-shaped value in a diff, it must flag the diff as a Security Agent finding and block the change.

---

## 8. Server write access

- Agents have **no** root or server write access at first.
- All agent work begins in the **repo sandbox**: feature branch, branch + PR workflow, human approval before merge.
- Server access (read or write) is granted only after:
  - the agent has demonstrated discovery-only behaviour over several real tasks,
  - the operator has issued a scoped, time-bound credential,
  - the credential is for a non-production environment first,
  - audit and revocation paths are tested.
- Production server access by any agent remains **explicitly out of scope** until a dedicated, approved sprint opens.

---

## 9. Branch / PR / merge workflow

- Agent commits land on a feature branch (`agent/IA-<n>-<slug>`).
- Pull requests open against `master` and require human review.
- The QA / Audit Agent runs the project's documented test commands and attaches the captured output to the PR.
- The Security Agent attaches its discovery output to the PR.
- The Legal Safety Agent attaches its verdict if any change touches a legal-safety surface.
- Merge requires a human approver.

---

## 10. What an agent must do when it does not know

If the agent cannot classify a port, a service, a manifest, a secret, a policy, or a code path, it must:

1. Tag the object `UNKNOWN_DO_NOT_TOUCH`.
2. Open a discovery task.
3. Stop. No further action against the object.
4. Hand off to the human operator.

There is no "best effort" exception.

---

## 11. Hard prohibitions (summary)

- No SSH change.
- No firewall change.
- No K3s mutation.
- No Traefik / cert-manager / Ollama / Postgres / Redis / NATS mutation in production.
- No exposed-port creation or expansion.
- No production secret read or write.
- No production deploy.
- No direct commit to `master`.
- No touch of `UNKNOWN_DO_NOT_TOUCH` resources.
- No claim of "hardening complete", "security applied", or "ports closed" without a captured before / after report and human approval.

---

## 12. Status

This document is documentation only. It does **not** install any agent. It does **not** mutate the cluster, the firewall, SSH, or any port. It does **not** claim production readiness, hardening completion, or agent activation.
