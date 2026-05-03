import type { ScheduleOfLossLine, UnfairDismissalInputs } from "./compensation.types";

export function buildScheduleOfLoss(input: UnfairDismissalInputs, basic: number, compNet: number): ScheduleOfLossLine[] {
  const pay = input.weeklyPayGbp;
  return [
    {
      heading: "Basic award (unfair dismissal)",
      amountLowGbp: basic * 0.95,
      amountMidGbp: basic,
      amountHighGbp: basic * 1.05,
    },
    {
      heading: "Past loss of earnings (gross scaffold)",
      amountLowGbp: pay * input.pastLossWeeks * 0.85,
      amountMidGbp: pay * input.pastLossWeeks,
      amountHighGbp: pay * input.pastLossWeeks * 1.1,
    },
    {
      heading: "Future loss of earnings (gross scaffold)",
      amountLowGbp: pay * input.futureLossWeeks * 0.7,
      amountMidGbp: pay * input.futureLossWeeks,
      amountHighGbp: pay * input.futureLossWeeks * 1.15,
    },
    {
      heading: "Net compensatory (after mitigation / Polkey / contributory — rolled)",
      amountLowGbp: compNet * 0.9,
      amountMidGbp: compNet,
      amountHighGbp: Math.min(compNet * 1.1, compNet + pay * 4),
      notes: "Tax, NI, and pension intricacies not modelled.",
    },
  ];
}
