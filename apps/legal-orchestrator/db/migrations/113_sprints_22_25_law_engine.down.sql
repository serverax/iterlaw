-- Down migration 113 (dev only).

DROP POLICY IF EXISTS evidence_chain_edges_ws_delete ON public.evidence_chain_edges;
DROP POLICY IF EXISTS evidence_chain_edges_ws_update ON public.evidence_chain_edges;
DROP POLICY IF EXISTS evidence_chain_edges_ws_mutate ON public.evidence_chain_edges;
DROP POLICY IF EXISTS evidence_chain_edges_ws_select ON public.evidence_chain_edges;

DROP POLICY IF EXISTS law_module_reranker_calibration_admin_all ON public.law_module_reranker_calibration;

DROP POLICY IF EXISTS law_module_calculator_fusion_runs_admin_all ON public.law_module_calculator_fusion_runs;
DROP POLICY IF EXISTS law_module_calculator_fusion_runs_ws_insert ON public.law_module_calculator_fusion_runs;
DROP POLICY IF EXISTS law_module_calculator_fusion_runs_ws_select ON public.law_module_calculator_fusion_runs;

DROP TABLE IF EXISTS public.evidence_chain_edges;
DROP TABLE IF EXISTS public.law_module_reranker_calibration;
DROP TABLE IF EXISTS public.law_module_calculator_fusion_runs;
