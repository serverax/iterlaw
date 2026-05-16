DROP POLICY IF EXISTS client_proof_cache_admin_delete ON public.client_proof_cache;
DROP POLICY IF EXISTS client_proof_cache_self_insert ON public.client_proof_cache;
DROP POLICY IF EXISTS client_proof_cache_self_select ON public.client_proof_cache;

DROP POLICY IF EXISTS wasm_module_registry_admin_all ON public.wasm_module_registry;

DROP TABLE IF EXISTS public.client_proof_cache;
DROP TABLE IF EXISTS public.wasm_module_registry;
