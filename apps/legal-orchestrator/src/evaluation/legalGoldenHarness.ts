// Sprint 25 — Legal golden evaluation harness.
//
// Deterministic harness that runs a list of pre-defined UK Employment law
// scenarios against an injected answer oracle and compares the oracle's
// output to the scenario's expected result.
//
// Pure function. No external LLM. No DB. No network. The harness does NOT
// produce answers itself; it consumes an `oracle` dependency that the
// caller supplies. When no oracle is injected, every scenario is recorded
// with `actual: insufficient_sources`, matching IterLaw's safe-default
// contract.

export type LegalGoldenOutcome =
  | "answered"
  | "insufficient_sources"
  | "needs_more_facts"
  | "citation_failed";

export interface LegalGoldenScenario {
  /** Stable id, e.g. "unfair_dismissal_1". */
  readonly id: string;
  /** Short label, e.g. "Unfair dismissal — 2-year qualifying service". */
  readonly label: string;
  /** Test question. Synthetic; not a real client question. */
  readonly question: string;
  /** Inputs the oracle is expected to consume. */
  readonly inputs: Readonly<Record<string, unknown>>;
  /**
   * Whether the scenario fixture includes the evidence/source the oracle
   * would need. When `false`, the scenario expects `insufficient_sources`.
   */
  readonly evidenceAvailable: boolean;
  /** Expected outcome shape when run by a competent oracle. */
  readonly expected: {
    readonly outcome: LegalGoldenOutcome;
    /** Optional well-known reason code the oracle must surface. */
    readonly reasonContains?: string;
  };
}

export interface LegalGoldenOracleResult {
  readonly outcome: LegalGoldenOutcome;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface LegalGoldenOracle {
  (scenario: LegalGoldenScenario): Promise<LegalGoldenOracleResult> | LegalGoldenOracleResult;
}

export interface LegalGoldenRunResult {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly expected: LegalGoldenScenario["expected"];
  readonly actual: LegalGoldenOracleResult;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface LegalGoldenSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: ReadonlyArray<LegalGoldenRunResult>;
}

const INSUFFICIENT_SOURCES_RESULT: LegalGoldenOracleResult = {
  outcome: "insufficient_sources",
  reasonCodes: ["golden:no_oracle_injected", "golden:safe_default"],
};

export async function runLegalGoldenScenarios(
  scenarios: ReadonlyArray<LegalGoldenScenario>,
  oracle?: LegalGoldenOracle,
): Promise<LegalGoldenSummary> {
  const results: LegalGoldenRunResult[] = [];
  for (const sc of scenarios) {
    const actual: LegalGoldenOracleResult = oracle
      ? await Promise.resolve(oracle(sc))
      : INSUFFICIENT_SOURCES_RESULT;

    const reasonCodes: string[] = [];
    let pass = actual.outcome === sc.expected.outcome;
    if (pass && sc.expected.reasonContains) {
      pass = actual.reasonCodes.some((r) => r.includes(sc.expected.reasonContains!));
      if (!pass) reasonCodes.push("golden:reason_code_missing");
    }
    if (!pass) reasonCodes.push(`golden:outcome_mismatch:${actual.outcome}_vs_${sc.expected.outcome}`);

    results.push({
      id: sc.id,
      label: sc.label,
      pass,
      expected: sc.expected,
      actual,
      reasonCodes,
    });
  }
  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
