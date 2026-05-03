import type { ArtResult, AeeResult, LawModule, RiskResult } from "../types/legal.types";
import { logger } from "../utils/logger";

/** Join narrative + structured strings for keyword scans. */
function riskCorpus(text: string, aee: AeeResult, art: ArtResult): string {
  const parts = [
    text,
    ...aee.facts,
    ...(aee.issueTypeGuess ? [aee.issueTypeGuess] : []),
    ...art.issues,
    ...art.weaknesses,
  ];
  return parts.join("\n");
}

function hasDiscriminationSignal(corpus: string): boolean {
  return (
    /\b(discrimination|discriminate|discriminated|discriminatory)\b/i.test(corpus) ||
    /\b(equality act|eqa\s*2010|protected characteristic)\b/i.test(corpus) ||
    /\b(harassment|harassed|victimisation|victimized|victimised)\b/i.test(corpus) ||
    /\b(equal pay|pay gap|gender pay)\b/i.test(corpus) ||
    /\b(racial|racism|race discrimination|colour|ethnic origin)\b/i.test(corpus) ||
    /\b(sex discrimination|gender discrimination|pregnancy discrimination|maternity discrimination)\b/i.test(
      corpus,
    ) ||
    /\b(disability discrimination|reasonable adjustment|adjustments)\b/i.test(corpus) ||
    /\b(age discrimination|ageist)\b/i.test(corpus) ||
    /\b(religion or belief|religious discrimination|belief discrimination)\b/i.test(corpus) ||
    /\b(sexual orientation|lgbt|homophobic|transphobic|gender reassignment)\b/i.test(corpus) ||
    /\b(menopause|perimenopause)\b.*\b(discrimination|discriminat|harass)\b/is.test(corpus)
  );
}

function hasDismissalWithoutProcedure(corpus: string, module: LawModule): boolean {
  if (module !== "employment-law") return false;
  const dismissal =
    /\b(dismiss(ed|al)?|sacked|fired|termination of employment|employment terminated|let go|made redundant|redundancy selection|summary dismissal)\b/i.test(
      corpus,
    );
  const noFairProcedure =
    /\b(no (disciplinary|hearing|investigation|procedure|process|warning)|without (a |any )?(fair )?(disciplinary|hearing|investigation|procedure|process)|skipped (the )?(process|hearing|investigation)|never (had|got|given) (a |any )?(hearing|meeting|warning)|no right of appeal|no appeal (hearing|offered)|instant dismissal|on the spot|out of the blue|no meetings?)\b/i.test(
      corpus,
    );
  return dismissal && noFairProcedure;
}

function hasNoEvidenceAllegation(corpus: string): boolean {
  return (
    /\b(no evidence|without evidence|no proof|haven'?t (seen|received|been given) (any )?evidence|unclear evidence|weak evidence|vague evidence|no documentation|no pack|no disclosure|fabricated evidence|trumped-?up)\b/i.test(
      corpus,
    ) ||
    /\b(against me with( out)?\s+(no |little )?evidence)\b/i.test(corpus)
  );
}

function hasResignationUnderPressure(corpus: string): boolean {
  return (
    /\b(constructive dismissal|constructively dismissed)\b/i.test(corpus) ||
    /\b(forced to resign|pressured to resign|made to resign|had to resign|no choice but to resign)\b/i.test(
      corpus,
    ) ||
    /\b(resign or (else|be fired)|ultimatum.{0,30}resign)\b/i.test(corpus) ||
    /\b(felt I had to leave|felt I had no choice|left because of.{0,40}(treatment|conduct|bullying|harassment))\b/i.test(
      corpus,
    ) ||
    /\b(last straw)\b/i.test(corpus)
  );
}

function scoreToLevel(score: number, forceCritical: boolean): RiskResult["riskLevel"] {
  if (forceCritical) return "critical";
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/**
 * Risk Engine — deterministic rules (no AI).
 * Rules: dismissal without procedure → HIGH; no evidence → HIGH;
 * discrimination keywords → CRITICAL; resignation under pressure → MEDIUM/HIGH.
 */
export function runRiskEngine(
  aee: AeeResult,
  art: ArtResult,
  text: string,
  module: LawModule,
): RiskResult {
  logger.info("RiskEngine: scoring", { module });
  const corpus = riskCorpus(text, aee, art);

  let score = 28;
  const reasons: string[] = [];
  const urgentFlags: string[] = [];

  score += Math.min(art.issues.length * 4, 16);
  score += Math.min(aee.facts.length * 2, 10);

  const discrimination = hasDiscriminationSignal(corpus);
  const dismissalNoProc = hasDismissalWithoutProcedure(corpus, module);
  const noEvidence = hasNoEvidenceAllegation(corpus);
  const resignPressure = hasResignationUnderPressure(corpus);

  if (discrimination) {
    score = Math.max(score, 88);
    reasons.push(
      "Discrimination, harassment, or Equality Act / protected-characteristic themes — treat as critical-priority triage.",
    );
    urgentFlags.push(
      "Preserve comparator evidence, policies, and offending correspondence; discrimination time limits can be short.",
    );
  }

  if (dismissalNoProc) {
    score = Math.max(score, 72);
    reasons.push(
      "Dismissal or termination alleged without fair procedure — procedural unfairness and unfair dismissal risk elevated.",
    );
    urgentFlags.push("Record dates of dismissal, investigation pack, warnings, and any appeal steps.");
  }

  if (noEvidence) {
    score = Math.max(score, 68);
    reasons.push(
      "Evidence gap or weak / opaque allegations — disclosure, data subject access, and witness strategy are decisive.",
    );
    if (!urgentFlags.some((f) => /evidence/i.test(f))) {
      urgentFlags.push("Do not delete messages or files; start a dated chronology with what exists.");
    }
  }

  if (resignPressure) {
    let pressuredScore = 52;
    if (/\b(bullying|harassment|hostile|toxic|undermined|undermining)\b/i.test(corpus)) {
      pressuredScore = 66;
    }
    if (discrimination) {
      pressuredScore = Math.max(pressuredScore, 72);
    }
    score = Math.max(score, pressuredScore);
    reasons.push(
      "Constructive dismissal / resignation under pressure — last-straw events and correspondence timing are high leverage.",
    );
    if (pressuredScore >= 60 && !urgentFlags.some((f) => /constructive/i.test(f))) {
      urgentFlags.push("Pinpoint the effective resignation date and any 'last straw' incidents with dates.");
    }
  }

  if (/urgent|immediately|today|tomorrow|deadline|hearing|tribunal date/i.test(text)) {
    score += 8;
    urgentFlags.push("Time-sensitive language detected — triage limitation dates early.");
  }

  if (module !== "employment-law") {
    score += 4;
    reasons.push("Non-employment module: specialist litigation risk not fully modelled here.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const forceCritical = discrimination;
  let riskLevel = scoreToLevel(score, forceCritical);
  if (discrimination && riskLevel !== "critical") {
    riskLevel = "critical";
    score = Math.max(score, 85);
  }

  reasons.push(`Deterministic risk score ${score}/100 (not predictive of tribunal outcome).`);

  if (urgentFlags.length === 0 && score >= 60) {
    urgentFlags.push("Consider early regulated legal advice given elevated risk band.");
  }

  return { riskLevel, riskScore: score, reasons, urgentFlags };
}
