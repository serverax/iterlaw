// LegalRulesEngine — the contract the WASM-ready legal rules layer
// implements. For now this is a TypeScript placeholder; later sprints
// can swap in a WASM module that satisfies the same interface.

export interface LegalRulesEngine {
  checkDeadlineRisk(input: unknown): Promise<unknown>;
  rankSources(input: unknown): Promise<unknown>;
  verifyCitations(input: unknown): Promise<unknown>;
  calculateRemedy(input: unknown): Promise<unknown>;
}

/** TypeScript placeholder. Each method returns a deterministic
 *  `{ status: "not_implemented" }` envelope so callers can tell the
 *  difference between "not wired" and "rejected". No I/O. No LLM. */
export class TypeScriptLegalRulesEngine implements LegalRulesEngine {
  async checkDeadlineRisk(_input: unknown): Promise<unknown> {
    return { status: "not_implemented", check: "checkDeadlineRisk" };
  }
  async rankSources(_input: unknown): Promise<unknown> {
    return { status: "not_implemented", check: "rankSources" };
  }
  async verifyCitations(_input: unknown): Promise<unknown> {
    return { status: "not_implemented", check: "verifyCitations" };
  }
  async calculateRemedy(_input: unknown): Promise<unknown> {
    return { status: "not_implemented", check: "calculateRemedy" };
  }
}
