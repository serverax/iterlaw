/**
 * Injury to feelings / aggravated damages — not combined with unfair dismissal basic award here.
 * Returns optional standalone heads for discrimination matters (scaffold bands).
 */

export interface InjuryToFeelingsBandGbp {
  lower: number;
  upper: number;
  label: string;
}

/** Vento-style bands are updated periodically — placeholder static scaffold. */
export function estimateInjuryToFeelingsBand(): InjuryToFeelingsBandGbp {
  return {
    lower: 900,
    upper: 56_200,
    label: "Injury to feelings (Vento-style bands — verify current Presidential Guidance; not calculated numerically here).",
  };
}
