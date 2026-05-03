import type { UnfairDismissalInputs } from "./compensation.types";

/** Heuristic extraction of numbers from narrative — defaults when missing. */
export function inferUnfairDismissalInputsFromText(text: string): UnfairDismissalInputs {
  const weekly = text.match(/\b£?\s*(\d{3,4})\s*(?:\/|\sper\s)?week/i);
  const years = text.match(/\b(\d{1,2})\s*years?\s*(?:of\s)?service/i);
  const age = text.match(/\bage\s*(\d{2})\b/i);

  return {
    age: age ? Math.min(70, Math.max(16, parseInt(age[1], 10))) : 35,
    weeklyPayGbp: weekly ? Math.min(5000, parseInt(weekly[1], 10)) : 600,
    yearsOfService: years ? Math.min(40, parseInt(years[1], 10)) : 3,
    pastLossWeeks: /\b(no job|still unemployed|8 weeks)\b/i.test(text) ? 12 : 8,
    futureLossWeeks: /\b(future loss|6 months)\b/i.test(text) ? 24 : 12,
    pensionLossFactor: 0.08,
    benefitsLossGbp: /\b(benefits)\b/i.test(text) ? 800 : 0,
    mitigationFactor: /\b(new job|mitigat)\b/i.test(text) ? 0.25 : 0.1,
    polkeyFactor: /\b(polkey|chance i would have been dismissed)\b/i.test(text) ? 0.2 : 0.1,
    contributoryFactor: /\b(contribut|blame)\b/i.test(text) ? 0.15 : 0,
    acasUpliftFactor: /\b(acas|breach code)\b/i.test(text) ? 0.15 : 0,
  };
}
