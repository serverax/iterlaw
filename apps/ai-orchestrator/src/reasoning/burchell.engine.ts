/**
 * Burchell-stage assessment — deterministic scaffold (no invented case law).
 */

export interface BurchellAssessment {
  genuineBelief: "likely" | "unclear" | "weak";
  reasonableGrounds: "likely" | "unclear" | "weak";
  reasonableInvestigation: "likely" | "unclear" | "weak";
  notes: string[];
}

export function assessBurchellFromText(text: string): BurchellAssessment {
  const t = text.toLowerCase();
  const notes: string[] = [];

  const noInvestigation =
    /\b(no investigation|without investigation|no hearing|no disciplinary|skipped process)\b/i.test(t);
  const someProcess =
    /\b(investigation|hearing|disciplinary|minutes|meeting|warnings?)\b/i.test(t);

  let investigation: BurchellAssessment["reasonableInvestigation"] = "unclear";
  if (noInvestigation) {
    investigation = "weak";
    notes.push("Narrative suggests absent or minimal investigation — Burchell 'reasonable investigation' harder for employer.");
  } else if (someProcess) {
    investigation = "likely";
    notes.push("Some procedural steps referenced — investigation quality still fact-specific.");
  } else {
    notes.push("Investigation quality not clearly evidenced in free text.");
  }

  const vagueAllegation = /\b(no evidence|unclear evidence|vague)\b/i.test(t);
  const grounds: BurchellAssessment["reasonableGrounds"] = vagueAllegation ? "weak" : "unclear";
  if (vagueAllegation) {
    notes.push("Weak or unclear factual basis may undermine reasonable grounds for belief.");
  }

  const belief: BurchellAssessment["genuineBelief"] = noInvestigation && vagueAllegation ? "weak" : "unclear";

  return {
    genuineBelief: belief,
    reasonableGrounds: grounds,
    reasonableInvestigation: investigation,
    notes,
  };
}
