-- =====================================================================
-- 107_tenant_module_entitlements.sql
-- =====================================================================
-- IterLaw — per-tenant law-module entitlement schema (Sprint 35).
--
-- Adds a multi-country, multi-law-module entitlement table the orchestrator
-- consults before granting access to any law module. The schema is reusable
-- across every planned module:
--
--   * employment, housing, immigration, benefits, debt, family, consumer,
--     business_contract, tax, ...
--
-- AND across every jurisdiction (UK_ENGLAND_WALES, UK_SCOTLAND, IE, ...).
--
-- Idempotency contract
-- --------------------
--   * Every CREATE / ALTER uses IF NOT EXISTS.
--   * No DROP, no DELETE, no TRUNCATE.
--   * Re-running this migration on a database that already has the
--     tables is a no-op.
--
-- RLS posture
-- -----------
-- Tenant-scoped table. RLS policies are NOT enabled here; they belong
-- to the next 106-style enablement migration. Until then the API must
-- gate every read/write at the application layer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- public.tenant_module_entitlements
-- ---------------------------------------------------------------------
-- One row per (tenant, country, module) entitlement grant. Multiple rows
-- per tenant are allowed (e.g. UK Employment + UK Housing). A tenant with
-- no rows has no entitlements.
CREATE TABLE IF NOT EXISTS public.tenant_module_entitlements (
  entitlement_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid        NOT NULL,
  -- Workspace = the orchestrator's tenant boundary. May or may not equal
  -- tenant_id depending on operator deployment; both are recorded.
  workspace_id           uuid        NOT NULL,
  -- ISO-style jurisdiction (e.g. 'UK_ENGLAND_WALES', 'UK_SCOTLAND').
  country                text        NOT NULL,
  -- Law-module identifier — matches `LawModule.moduleId` in the registry
  -- (e.g. 'uk_employment', 'uk_housing'). Free-form text to avoid coupling
  -- the DB schema to a Typescript enum.
  module_id              text        NOT NULL,
  -- Status flag. Allowed values (enforced by CHECK below):
  --   'active'    — within window and explicitly enabled
  --   'inactive'  — disabled by operator
  --   'expired'   — past effective_to (kept for audit history)
  --   'pending'   — approved but not yet within effective_from
  status                 text        NOT NULL,
  effective_from         timestamptz NOT NULL,
  effective_to           timestamptz,
  -- Free-form metadata the operator may attach (billing reference,
  -- approval ticket, etc.). Must not contain secrets — application-layer
  -- responsibility.
  metadata               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_module_entitlements_status_check
    CHECK (status IN ('active', 'inactive', 'expired', 'pending')),
  CONSTRAINT tenant_module_entitlements_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_tenant_module_entitlements_lookup
  ON public.tenant_module_entitlements (workspace_id, country, module_id);

CREATE INDEX IF NOT EXISTS idx_tenant_module_entitlements_tenant
  ON public.tenant_module_entitlements (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_module_entitlements_active
  ON public.tenant_module_entitlements (workspace_id, module_id)
  WHERE status = 'active';

COMMENT ON TABLE public.tenant_module_entitlements IS
  'Per-tenant per-(country,module) law-module entitlement (Sprint 35).';
COMMENT ON COLUMN public.tenant_module_entitlements.country IS
  'ISO-style jurisdiction matching the law-module registry, e.g. UK_ENGLAND_WALES.';
COMMENT ON COLUMN public.tenant_module_entitlements.module_id IS
  'Free-form module id matching LawModule.moduleId, e.g. uk_employment.';
COMMENT ON COLUMN public.tenant_module_entitlements.status IS
  'One of active / inactive / expired / pending. Application gate fails closed on anything other than active.';
