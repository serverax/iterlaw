// Public surface of the modules layer.
export { ruleEngine } from "./ruleEngine";
export { deadlineChecker } from "./deadlineChecker";
export { citationVerifier } from "./citationVerifier";
export { policyGateModule } from "./policyGate";
export { sourceRanker } from "./sourceRanker";
export { piiRedactor } from "./piiRedactor";
export { runLegalModulePipeline } from "./modulePipeline";
export type { ModulePipelineInput, ModulePipelineOutput } from "./modulePipeline";
export { UK_EMPLOYMENT_CONTEXT, UK_EMPLOYMENT_RULESET } from "./legal-packs/uk_employment";
export { SE_EMPLOYMENT_CONTEXT, SE_EMPLOYMENT_RULESET } from "./legal-packs/se_employment";
export type * from "./contracts";
