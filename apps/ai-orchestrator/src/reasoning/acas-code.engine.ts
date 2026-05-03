/**
 * ACAS Code compliance — checklist-style deterministic scaffold.
 */

export interface AcasComplianceAssessment {
  alignedWithCode: "likely" | "unclear" | "unlikely";
  proceduralGaps: string[];
}

export function assessAcasCode(text: string): AcasComplianceAssessment {
  const t = text.toLowerCase();
  const gaps: string[] = [];

  if (/\b(no hearing|no meeting|no warning|instant dismissal|summary dismissal)\b/i.test(t)) {
    gaps.push("Potential failure to follow fair procedure / investigation before sanction.");
  }
  if (/\b(no right of appeal|no appeal)\b/i.test(t)) {
    gaps.push("Appeal stage not evidenced — Code expects reasonable appeal where practicable.");
  }

  const unlikely = gaps.length >= 2;
  const likely = gaps.length === 0 && /\b(hearing|investigation|grievance|appeal)\b/i.test(t);

  return {
    alignedWithCode: unlikely ? "unlikely" : likely ? "likely" : "unclear",
    proceduralGaps: gaps,
  };
}
