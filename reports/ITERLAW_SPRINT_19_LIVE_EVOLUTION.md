# Sprint 19 — Live evolution (versioning + A/B)

## Status

Zone 2 deliverables for this sprint are implemented as a bounded slice aligned with `SPRINTS_16_TO_57_HYBRID_MAPPING.md` Sprint 19.

## Database (migration 110)

- `public.prompt_versions` — `prompt_key`, `version`, `content_hash`, `content`, `created_by`, `approved_at`, `created_at`
- `public.rule_versions` — `rule_key`, same version/hash pattern
- `public.ab_test_flags` — `flag_name`, `enabled`, `segment_rules` (JSONB)
- `public.ab_test_metrics` — `test_id`, `variant_version`, `conversion_rate`, `error_rate`, `recorded_at`
- RLS enabled on all four tables; admin-only policies using `current_app_user_is_admin()`

## Application (in-process)

- `src/liveEvolution/versionRegistry.ts` — append-only versions, active pointer, rollback, diff, approve, SHA-256 content hash
- `src/liveEvolution/promptAndRuleRegistries.ts` — `PromptRegistry`, `RuleRegistry` subclasses
- `src/liveEvolution/abTestFramework.ts` — flag enablement + optional tier segmentation + metric rows

## Zone 1 (admin UI)

Routes described in the mapping (`/admin/prompts/versions`, `/admin/rules/versions`, `/admin/ab-tests`) are not part of this slice; they can reuse the Sprint 18 admin gate when added.

## Verification

- `npm test` in `apps/legal-orchestrator` (Vitest): migration contract tests + `sprint19LiveEvolution.test.ts`

## Production readiness

Schema and registries support safe prompt/rule evolution and A/B metadata; wire HTTP/Temporal in a later sprint when needed.
