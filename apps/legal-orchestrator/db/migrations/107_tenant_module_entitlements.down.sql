-- =====================================================================
-- 107_tenant_module_entitlements.down.sql
-- =====================================================================
-- Reverses 107_tenant_module_entitlements.sql.
-- Operator-only; never run automatically.

DROP INDEX IF EXISTS public.idx_tenant_module_entitlements_active;
DROP INDEX IF EXISTS public.idx_tenant_module_entitlements_tenant;
DROP INDEX IF EXISTS public.idx_tenant_module_entitlements_lookup;
DROP TABLE IF EXISTS public.tenant_module_entitlements;
