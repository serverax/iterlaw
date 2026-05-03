import type { ReductionLine } from "./compensation.types";

export function contributoryReductionGbp(compensatoryAfterPolkey: number, contributoryFactor: number): ReductionLine {
  const f = Math.min(1, Math.max(0, contributoryFactor));
  const amount = Math.round(compensatoryAfterPolkey * f * 100) / 100;
  return {
    code: "contributory",
    label: "Contributory conduct reduction (scaffold)",
    amountGbp: amount,
    factor: f,
  };
}
