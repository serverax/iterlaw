# Workspace and User Data Architecture

How a user's private legal data is structured, isolated, and protected in IterLaw.

**Status:** mixed. Sprint 10 already shipped the user-workspace + RLS foundation (`104` / `105` / `106`). Sprints 46–48 extend it with subscription + case-management UX. The platform-level tables (`platform_countries`, `platform_modules`, `user_subscriptions`, etc.) are **future / target architecture**.

## Mental model

```
IterLaw
  -> user account
        -> subscriptions
              -> workspaces
                    -> cases
                          -> timeline events
                          -> documents
                          -> deadlines
                          -> question history
                          -> loyalty / usage
```

A **user** subscribes to one or more `(country, module)` pairs. Each subscription opens a **workspace**. A workspace holds **cases**. Each case has its own timeline, documents, deadlines, question history, and usage signals.

## Data isolation rules

- **All private user data must use PostgreSQL RLS.** Application checks are not a substitute.
- **Private tables must include `user_id`.** RLS policies key on `current_app_user_id()`.
- **Workspace tables must include `workspace_id`.** RLS policies key on `current_user_in_workspace(workspace_id)`.
- **Module-scoped tables must include `module_id` where relevant.** RLS policies check subscription entitlement before allowing read.
- A user must not be able to:
  - access an **unpaid** module,
  - access another user's workspace, case, document, timeline event, deadline, or question history,
  - read corpus rows tagged as another module's content via a join trick.
- The backend MUST set the session GUCs (`app.user_id`, `app.user_role`, `app.workspace_id`) before every query that touches user data. Failure to set them is fail-closed (no rows returned).
- See [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md) for the policy details.

## Planned objects

Mark as **future / target** where not already implemented.

### Identity & subscription (target, not yet implemented)

| Object | Purpose | Status |
| --- | --- | --- |
| `users` | One row per registered user. Identity, locale, status. | **Implemented** (Sprint 10 migration 104). |
| `platform_countries` | Registered country codes + default language + status. | Target — Sprint 46. |
| `platform_modules` | Registered `(country, domain)` modules + status. | Target — Sprint 46. |
| `user_subscriptions` | Per-user subscription rows (country, module, plan, status, validity). | Target — Sprint 46. |

### Workspace, cases, timeline (Sprint 10 + extensions)

| Object | Purpose | Status |
| --- | --- | --- |
| `workspaces` | Tenant container. One per subscription by default. | **Implemented** (104). |
| `workspace_members` | Mapping user → workspace + role. | **Implemented** (104). |
| `user_workspaces` | View / alias used in roadmap docs. Maps onto `workspaces` + `workspace_members`. | Alias — no new table required. |
| `user_cases` | Cases inside a workspace. Maps onto current `legal_case_records`. | **Implemented** as `legal_case_records` (105). Rename / alias is a separate decision. |
| `case_timeline_events` | The user's case journey. Maps onto current `legal_case_timeline`. | **Implemented** as `legal_case_timeline` (105). |
| `case_documents` | Uploaded + generated documents per case. Maps onto current `legal_case_documents`. | **Implemented** as `legal_case_documents` (105). |
| `case_deadlines` | Statutory deadlines per case (e.g. ACAS clock, tribunal limitation). | Target — Sprint 48. |
| `question_history` | The user's questions + outcomes (status, refusal reason, citations). | Target — Sprint 46. |

### Module engine objects (target — see Law Module Engine doc)

| Object | Purpose | Status |
| --- | --- | --- |
| `module_qa_cache` | Pre-built Q&A entries. | Target — Sprint 19+. |
| `law_section_modules` | Addressable plain-English law sections. | Target — Sprint 21+. |
| `human_approval_queue` | Items requiring human review (low-conf answers, new sections, amendments, refunds, GDPR requests, ...). | Target — Sprint 50. |

### Loyalty / engagement (target)

| Object | Purpose | Status |
| --- | --- | --- |
| `user_loyalty` | Per-user loyalty / engagement record. | Target — Sprint 46+. |
| `loyalty_transactions` | Per-event loyalty ledger. | Target — Sprint 46+. |

## Naming reconciliation

The Sprint 10 migrations use the existing names (`legal_case_records`, `legal_case_timeline`, `legal_case_documents`). The roadmap names (`user_cases`, `case_timeline_events`, `case_documents`) are aliases used in higher-level architecture docs. Renaming the actual tables is **out of scope for this docs sprint**; either approach is acceptable for delivery, but the doc names must align to the existing migrations once a decision is made.

## RLS rule summary

For each user-data table:

```
ENABLE ROW LEVEL SECURITY;
CREATE POLICY <name> ON <table>
  USING (<isolation predicate>);
```

Predicates (Sprint 10 already shipped these helpers — see migration `106`):

- `current_app_user_id()` — reads `app.user_id` GUC.
- `current_app_user_role()` — reads `app.user_role` GUC.
- `current_app_user_is_admin()` — admin override.
- `current_user_in_workspace(uuid)` — workspace membership check.
- `current_user_can_write_workspace(uuid)` — write entitlement.
- `current_user_can_write_case(workspace_id, assigned_user_id)` — case write entitlement.

INSERT policies for normal users are **not** generic; the backend service role inserts on the user's behalf with the session GUCs set. See `../05-security/RLS_SECURITY_MODEL.md`.

## Cross-module behaviour

- Workspaces are **module-scoped**. A workspace belongs to one `(country, module)` subscription.
- Cases inside a workspace inherit that scope.
- Question history rows carry `module_id`. They are never aggregated across modules without explicit operator action.
- Loyalty / usage is **per user**, not per module — but reporting can roll up by module.

## Subscription entitlement and RLS

When the user opens a case, the backend:

1. Sets `app.user_id`, `app.user_role`, `app.workspace_id` GUCs.
2. Queries `user_subscriptions` to confirm the workspace's `(country, module)` is paid.
3. Proceeds only if active. Else returns `module_not_subscribed`.

This check is in **addition to** the RLS policy. RLS guarantees row-level isolation; the subscription gate guarantees the user is allowed inside the module at all.

## Audit

Every state-changing operation on user data writes an audit row with `request_id`, `trace_id`, `user_id`, `workspace_id`, `module_id`, `action_type`. **No secret values, no raw prompts, no document text.** See the Sprint 11 audit redactor for the contract.

## Status

- Sprint 10 user-workspace + RLS foundation: **PASS** in repo + Docker staging (2026-05-13 replay). Non-Docker staging promotion remains a separate operator decision.
- Subscription / module engine tables: **NOT IMPLEMENTED**. Target — Sprints 19, 21, 46, 50.
- Production: **BLOCKED** (separate gate set; live backup/restore/deployment NOT AUTHORISED).

## Related

- RLS details: [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md)
- Sprint 10 decisions: [`../07-sprints/SPRINT_10_DB_DECISIONS.md`](../07-sprints/SPRINT_10_DB_DECISIONS.md)
- Sprint 10 staging checklist: [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md)
- Subscription gate flow: [`MODULE_SUBSCRIPTION_ARCHITECTURE.md`](MODULE_SUBSCRIPTION_ARCHITECTURE.md)
