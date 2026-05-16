import type { StatutoryCalculatorStatus } from "../legalRules/statutoryCalculatorRegistry.js";

/**
 * Blend reranker confidence (0–1) with calculator implementation readiness.
 * `implemented` calculators contribute full weight toward the "calc" lane.
 */
export function blendRerankerWithCalculator(
  calculatorStatus: StatutoryCalculatorStatus | null,
  meanRerankerScore: number,
  weightCalc = 0.55,
): number {
  let implLane = 0;
  if (calculatorStatus === "implemented") {
    implLane = 1;
  } else if (calculatorStatus === "planned") {
    implLane = 0.35;
  }
  const r = Math.min(1, Math.max(0, meanRerankerScore));
  const w = Math.min(1, Math.max(0, weightCalc));
  return w * implLane + (1 - w) * r;
}
