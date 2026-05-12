# Module Subscription Architecture

How a user becomes entitled to ask legal questions in a given `(country, module)` scope, and how the backend enforces that entitlement on every request.

**Status:** target architecture. Not yet implemented. See `ROADMAP_REMAINING_SPRINTS.md` (Sprint 46).

## Mental model

```
user account
  └── subscriptions
        ├── (country_id, module_id)
        ├── plan tier (free / starter / pro / enterprise)
        ├── start / end / renewal
        └── status (active / paused / cancelled / past_due)
```

A user can subscribe to **one or more** modules. Each subscription unlocks **one** `(country, module)` scope.

## User journey

1. **Country choice.** User picks their country (UK, Sweden, Germany, ...).
2. **Module choice.** User picks one or more law domains within that country (Employment, Housing, Immigration, ...).
3. **Plan choice.** User picks a plan tier (free / starter / pro / enterprise).
4. **Payment / activation.** Subscription becomes `active`.
5. **Dashboard view.** Subscribed modules show as usable workspaces. **Locked modules show an upgrade message.**

## Example modules (illustrative)

| Module | Country | Domain |
| --- | --- | --- |
| UK Employment | UK | Employment |
| UK Housing | UK | Housing |
| UK Immigration | UK | Immigration |
| UK Benefits | UK | Benefits |
| Saudi Labour Law | Saudi Arabia | Employment |
| UAE Employment | UAE | Employment |
| Germany Immigration | Germany | Immigration |
| Sweden Employment | Sweden | Employment |

These are placeholders. Available modules are decided per release and gated by the corpus + rule pack being ready.

## Multi-module discount (planned)

Subscription pricing logic, **in prose** (not executable production code):

- **1 module** — normal price for the selected plan tier.
- **2 modules** — discounted (each module slightly cheaper than buying one).
- **3+ modules** — bigger per-module discount.
- **All modules bundle** — flat platform price that ignores the linear add-up.

Pricing details, currencies, and the exact discount curve are commercial decisions and live in the billing service, not in this doc.

## Backend entitlement rule

Every legal question MUST carry:

- `user_id`
- `country_id`
- `module_id`

The orchestrator enforces, before any retrieval / drafting:

```
SELECT 1
  FROM user_subscriptions s
 WHERE s.user_id = :user_id
   AND s.country_id = :country_id
   AND s.module_id = :module_id
   AND s.status = 'active'
   AND s.starts_at <= now()
   AND (s.ends_at IS NULL OR s.ends_at >= now())
```

- Match → proceed.
- No match → return `module_not_subscribed`.

The check runs on **every** request. UI hiding is not a substitute for backend enforcement. Locked modules in the dashboard purely reduce friction; they do not constitute access control.

## RLS interaction

The user-data tables that hold a `module_id` field (e.g. `question_history`, `user_workspaces`, `user_cases`) carry an RLS policy that requires the request session to expose either:

- a workspace membership row, or
- an active subscription row covering `(country_id, module_id)`.

This is enforced by the database, not by the application alone. See [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md).

## Planned tables

These are **planned**, not committed:

- `platform_countries(country_id, country_code, country_name, language_default, status)` — registered countries.
- `platform_modules(module_id, country_id, domain_code, display_name, status)` — registered (country, domain) modules.
- `user_subscriptions(user_id, country_id, module_id, plan_tier, status, starts_at, ends_at, ...)` — active subscriptions.
- `subscription_events(subscription_id, event_type, occurred_at, payload)` — billing event audit.

`platform_modules` carries a `status` so a module can be in `disabled`, `beta`, `general_availability`, or `deprecated` state independent of any user.

## Dashboard rules

- Subscribed modules appear as **workspaces** (one workspace per subscription, by default).
- Locked modules appear in the catalogue with a **"Subscribe to unlock"** action.
- A user with no active subscription sees the catalogue + the free intro module (UK Employment, free tier — exact intro plan TBD).
- Workspace switcher shows only active subscriptions; expired ones move to the catalogue.

## Cross-module behaviour

- No cross-module retrieval inside one question. A UK Employment question never reads from a UK Housing corpus.
- A user can hold multiple module subscriptions and switch context, but each question is module-locked.
- Document templates, calculators, and prompts are scoped to the module the question is asked in.

## Operator guardrails

- Module ID and country ID are **server-side validated** against `platform_modules` on every request.
- Subscription gate runs before the citation gate so an unpaid request never reaches retrieval.
- Failed subscription checks emit an audit row (which user, which module, when) with **no sensitive payload**.
- Subscription mutation (upgrade, downgrade, cancel) is logged in `subscription_events`.
- Refunds and disputes route through the human approval queue (`SUPREME_CONTROLLER_ARCHITECTURE.md`).

## Status

- First beta will ship with **one module** — UK Employment — and a single-plan billing model.
- Multi-module + multi-country dashboard + entitlement gate is **target architecture**.
- Sprint 46 covers the user-workspace + subscription foundation. Sprint 47 covers RLS for user data.
- Sprint 10 already includes the user-workspace + RLS migration chain (`104` / `105` / `106`); subscription tables come later.
- Production: **BLOCKED**. Real staging DB verification: **PENDING**.
