/**
 * Compensation calculator types — Phase 3 scaffold (deterministic formulas where coded).
 */

export interface ReductionLine {
  code: "polkey" | "contributory" | "cap" | "mitigation" | "other";
  label: string;
  /** Positive GBP amount removed from gross estimate */
  amountGbp: number;
  /** Optional factor 0–1 for audit trail */
  factor?: number;
}

export interface ScheduleOfLossLine {
  heading: string;
  amountLowGbp: number;
  amountMidGbp: number;
  amountHighGbp: number;
  notes?: string;
}

/** Aggregated calculator output for API / pipeline. */
export interface CompensationEstimateOutput {
  basicAward: number;
  compensatoryAward: number;
  acasUplift: number;
  reductions: ReductionLine[];
  totalLow: number;
  totalMid: number;
  totalHigh: number;
  assumptions: string[];
  warnings: string[];
  scheduleOfLoss: ScheduleOfLossLine[];
}

export interface UnfairDismissalInputs {
  age: number;
  weeklyPayGbp: number;
  yearsOfService: number;
  /** Weeks of past net loss (post-tax approximation not modelled) */
  pastLossWeeks: number;
  futureLossWeeks: number;
  /** 0–1 proportion of pension loss modelled */
  pensionLossFactor: number;
  benefitsLossGbp: number;
  /** 0–1 mitigation haircut on compensatory head */
  mitigationFactor: number;
  /** 0–1 Polkey reduction on compensatory head */
  polkeyFactor: number;
  /** 0–1 contributory conduct reduction on compensatory head */
  contributoryFactor: number;
  /** 0–0.25 ACAS uplift on compensatory head */
  acasUpliftFactor: number;
}
