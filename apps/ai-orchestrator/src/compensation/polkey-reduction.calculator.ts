import type { ReductionLine } from "./compensation.types";

export function polkeyReductionGbp(compensatoryGross: number, polkeyFactor: number): ReductionLine {
  const f = Math.min(1, Math.max(0, polkeyFactor));
  const amount = Math.round(compensatoryGross * f * 100) / 100;
  return {
    code: "polkey",
    label: "Polkey / chance-based reduction (scaffold on compensatory head)",
    amountGbp: amount,
    factor: f,
  };
}
