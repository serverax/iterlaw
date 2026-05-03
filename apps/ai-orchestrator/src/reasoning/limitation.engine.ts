/**
 * Limitation / time limits — high-level ET triage flags (deterministic, not date advice).
 */

export interface LimitationFlags {
  urgentEtLimitation: boolean;
  notes: string[];
}

export function assessLimitationUrgency(text: string): LimitationFlags {
  const t = text.toLowerCase();
  const notes: string[] = [];
  let urgent = false;

  if (/\b(more than 3 months|over three months|years ago|long time ago)\b/i.test(t)) {
    urgent = true;
    notes.push("Possible limitation issue — effective date of act / dismissal / detriment must be checked urgently.");
  }
  if (/\b(acas early conciliation|ecc|conciliation)\b/i.test(t)) {
    notes.push("ACAS EC may extend time — clock calculation is fact-specific.");
  }
  if (/\b(dismissed yesterday|last week|recent dismissal)\b/i.test(t)) {
    notes.push("Recent events — limitation clock likely live; preserve dates and correspondence.");
  }

  return { urgentEtLimitation: urgent, notes };
}
