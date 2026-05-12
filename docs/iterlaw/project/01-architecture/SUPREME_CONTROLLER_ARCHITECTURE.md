# Supreme Controller Architecture

The Supreme Controller is the IterLaw **controller concept** that coordinates specialist agents around a request, an event, or a piece of legal content. It is an internal coordination role inside IterLaw — **it does not replace legal safety**.

**Status:** target architecture. Not implemented. See `ROADMAP_REMAINING_SPRINTS.md` (Sprint 49).

## What it is

- An orchestrator-of-orchestrators sitting above the agent registry.
- It does not generate legal text. It does not bypass refusal paths. It does not override RLS.
- It owns the **decision loop** around each user / system event and the path through the agent registry.

## What it is not

- Not a replacement for the citation gate, policy gate, or RLS.
- Not a single-shot LLM agent. It is a deterministic controller that delegates to specialists.
- Not the user-facing chat surface. It runs behind the orchestrator HTTP layer.

## Decision loop

```
PERCEIVE  →  REASON  →  HUMAN APPROVAL GATE  →  ACT  →  MONITOR
   ↑                                                        │
   └────────────────────────────────────────────────────────┘
```

1. **PERCEIVE.** Read the event: user question, queued background job, completed cache build, low-confidence flag, deadline timer.
2. **REASON.** Pick the agent registry path: classify → cache → retrieval → router → synthesis → validation → streamer.
3. **HUMAN APPROVAL GATE.** If the event hits any of the human-approval triggers below, hold and route to the approval queue. Otherwise, proceed.
4. **ACT.** Execute the chosen path. The acting agent enforces its own contract; the controller never bypasses it.
5. **MONITOR.** Capture outcome, latency, citations, refusal reason. Feed into observability + quality agents.

The loop runs **per request**. Long-running background jobs use the same loop but with a different timing model.

## Agent registry

| Agent | Role |
| --- | --- |
| `gatekeeper` | Auth, rate limit, subscription / entitlement check, abuse heuristic. |
| `classifier` | Intent + complexity classification; picks the retrieval tier path. |
| `cache_agent` | Tier 0 / Tier 1 cache lookup (`module_qa_cache` + Redis). |
| `rag_agent` | Tier 2 / Tier 3 retrieval over `law_section_modules` / `legal_chunks`. |
| `legal_api_agent` | External legal-data API client (target — none today; provider-allowlist gated). |
| `llm_router` | Local model choice (qwen / drafting / document). Reuses Sprint 11 `modelRouter`. |
| `synthesiser` | Tier 4 bounded synthesis under the citation gate. |
| `validator` | Post-synthesis verification: citation gate + retrieval-augmented verification (RAV). |
| `streamer` | SSE stream construction; backpressure; `safety_block`. |
| `subscription_agent` | Read / verify subscription state; emit `module_not_subscribed`. |
| `loyalty_agent` | Track user usage / loyalty signals. |
| `deadline_agent` | Compute + monitor statutory deadlines per case. |
| `document_agent` | Generate cited documents (DOCX / PDF / XLSX). |
| `case_agent` | Read / write case + workspace state. |
| `notification_agent` | Email / in-app notification dispatch. |
| `knowledge_agent` | Knowledge graph reader (deterministic facts). |
| `quality_agent` | Sample-based answer quality scoring + drift detection. |
| `security_agent` | Security signal handling (auth anomalies, exfiltration heuristics). |
| `escalation_agent` | Bridge to human reviewers / solicitors. |
| `approval_agent` | Read / write `human_approval_queue` items. |

Each agent has:

- a stable interface,
- a timeout,
- a memory cap,
- a safety contract it enforces locally,
- observability metrics + structured logging,
- feature flag (`ITERLAW_AGENT_<NAME>_ENABLED`).

## Human approval gate

The controller routes the following to `human_approval_queue` and **holds** the action until a reviewer approves:

| Trigger | Why |
| --- | --- |
| **Low-confidence legal answers** | Below the per-module confidence floor. **No low-confidence legal answer may be shown as final** without human approval. |
| **New AI-generated law sections** | New rows landing in `law_section_modules` start at `auto_generated`; promotion to `human_reviewed` / `solicitor_approved` is reviewer action. |
| **Law amendments** | Any change to an existing law-section row that affects `plain_english`, citation, or `effective_from` / `effective_to`. |
| **Solicitor referrals** | The user asked for, or the system flagged, a referral to a qualified solicitor. |
| **Urgent tribunal deadlines** | A statutory deadline is imminent / past. |
| **Critical security events** | Auth anomalies, suspected key compromise, exfiltration heuristics. |
| **Mass answer-quality degradation** | The quality agent detected a drop in cited-answer correctness across a module. |
| **Refunds / financial disputes** | Subscription refund, charge-back, manual billing override. |
| **GDPR / data export requests** | Subject access, erasure, portability requests. |

## Hard rules

- **No low-confidence legal answer is shown as final.** It is either improved (more retrieval / re-synthesis) or routed to the approval queue.
- **No agent may bypass the citation gate.** The `validator` is mandatory before the `streamer` emits any answer bytes.
- **No agent may bypass RLS.** Every read sets the session GUCs first.
- **No agent may bypass the subscription gate.** `gatekeeper` is the first stop.
- **No agent calls an external LLM provider.** Sprint 11 transport policy denies provider hosts at runtime.
- **No agent prints secret values** to logs, audit rows, or stream payloads.

## Audit

The controller writes a per-request audit envelope:

- `request_id`, `trace_id`, `user_id`, `module_id`.
- Each agent traversal: `agent_name`, `outcome`, `latency_ms`, `safety_decision`, optional `refusal_reason`.
- No raw prompt, no raw answer, no chunk text, no facts blob, no secret values. The Sprint 11 audit redactor's rules apply (see `apps/legal-orchestrator/src/legal/llm/llmAuditRedactor.ts`).

## Failure handling

| Failure | Controller response |
| --- | --- |
| Agent timeout | Mark agent `unavailable`, decide whether to retry, route, or refuse. |
| Agent crash | Capture; refuse with `internal_error`; raise to `security_agent` if pattern emerges. |
| Citation gate trip mid-stream | Stop the stream; `streamer` emits `safety_block`; rewrite the user message. |
| Quality agent flag | Hold the next response; route to approval queue + `notification_agent`. |
| Subscription absent | Refuse with `module_not_subscribed`; no further work. |

## Status

- Supreme Controller foundation: **not implemented**. Sprint 49 target.
- Approval queue table + agent: **not implemented**. Sprint 50 target.
- Existing Sprint 11 audit + transport policy is a prerequisite (`apps/legal-orchestrator/src/legal/llm/`); it is **PASS**.
- Production: **BLOCKED**.

## Related

- WASM module set (executes the agent registry near the data path): [`WASM_INTELLIGENCE_ARCHITECTURE.md`](WASM_INTELLIGENCE_ARCHITECTURE.md)
- Multi-tier retrieval: [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Workspace + RLS: [`WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`](WORKSPACE_AND_USER_DATA_ARCHITECTURE.md)
- Document agent contract: [`DOCUMENT_INTELLIGENCE_ARCHITECTURE.md`](DOCUMENT_INTELLIGENCE_ARCHITECTURE.md)
