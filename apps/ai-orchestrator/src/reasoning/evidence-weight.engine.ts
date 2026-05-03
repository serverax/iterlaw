/**
 * Evidence weight — deterministic narrative heuristics (not predictive).
 */

export interface EvidenceWeightAssessment {
  documentarySupport: "strong" | "moderate" | "weak";
  witnessRisk: "low" | "medium" | "high";
  notes: string[];
}

export function assessEvidenceWeight(text: string): EvidenceWeightAssessment {
  const t = text.toLowerCase();
  const notes: string[] = [];

  let doc: EvidenceWeightAssessment["documentarySupport"] = "moderate";
  if (/\b(no evidence|no emails|no contract|nothing in writing)\b/i.test(t)) {
    doc = "weak";
    notes.push("Limited documentary references — disclosure strategy will matter.");
  } else if (/\b(email|contract|minutes|letter|pdf|screenshot)\b/i.test(t)) {
    doc = "strong";
    notes.push("Some documentary references — preserve metadata and chains of custody.");
  }

  let witnessRisk: EvidenceWeightAssessment["witnessRisk"] = "medium";
  if (/\b(he said|she said|disputed|contradict)\b/i.test(t)) {
    witnessRisk = "high";
    notes.push("Credibility-heavy dispute — witness statements and chronology critical.");
  }

  return { documentarySupport: doc, witnessRisk, notes };
}
