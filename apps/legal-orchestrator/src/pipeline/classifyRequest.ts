// Deterministic classifier (Phase 5 of the bundle, narrowed).
// No LLM call. Rule-based. If no rule matches, returns 'unknown' but
// in a safe, structurally complete Classification — downstream code must
// be able to handle 'unknown' without crashing.

import type { Classification, RequestType, AreaOfLaw, ModelRole } from "../types/legal.js";

interface Rule {
  pattern: RegExp;
  questionType: RequestType;
  areaOfLaw: AreaOfLaw;
}

// Order matters: more specific rules first.
const RULES: Rule[] = [
  // Drafting requests
  { pattern: /\b(draft|write|prepare)\b.*\bgrievance\b/i, questionType: "grievance_draft", areaOfLaw: "grievance" },
  { pattern: /\b(draft|write|prepare)\b.*\bappeal\b/i, questionType: "appeal_draft", areaOfLaw: "disciplinary" },
  { pattern: /\b(draft|write|prepare)\b.*\bet1\b/i, questionType: "tribunal_form_help", areaOfLaw: "unknown" },
  { pattern: /\bgenerate\b.*\bletter\b/i, questionType: "document_generation", areaOfLaw: "unknown" },

  // Document review
  { pattern: /\breview\b.*\b(letter|contract|document|notice)\b/i, questionType: "document_review", areaOfLaw: "unknown" },
  { pattern: /\bsettlement\b.*\b(agreement|review)\b/i, questionType: "settlement_review", areaOfLaw: "settlement_agreement" },

  // Deadline / time-limit questions
  { pattern: /\b(time limit|deadline|when must I|how long do I have)\b/i, questionType: "deadline_check", areaOfLaw: "unknown" },

  // Area-of-law signals on legal_advice
  { pattern: /\bsuspend(ed|ing|s)?\b/i, questionType: "legal_advice", areaOfLaw: "suspension" },
  { pattern: /\bunfair\s+dismissal\b/i, questionType: "legal_advice", areaOfLaw: "unfair_dismissal" },
  { pattern: /\bconstructive\s+dismissal\b/i, questionType: "legal_advice", areaOfLaw: "constructive_dismissal" },
  { pattern: /\bdiscriminat\w*\b/i, questionType: "legal_advice", areaOfLaw: "discrimination" },
  { pattern: /\bharass\w*\b/i, questionType: "legal_advice", areaOfLaw: "harassment" },
  { pattern: /\bvictimis\w*\b/i, questionType: "legal_advice", areaOfLaw: "victimisation" },
  { pattern: /\bwhistleblow\w*\b/i, questionType: "legal_advice", areaOfLaw: "whistleblowing" },
  { pattern: /\bredundan\w*\b/i, questionType: "legal_advice", areaOfLaw: "redundancy" },
  { pattern: /\b(disciplinary|written warning|final warning)\b/i, questionType: "legal_advice", areaOfLaw: "disciplinary" },
  { pattern: /\bgrievance\b/i, questionType: "legal_advice", areaOfLaw: "grievance" },
  { pattern: /\b(holiday pay|annual leave|vacation pay)\b/i, questionType: "legal_advice", areaOfLaw: "holiday_pay" },
  { pattern: /\bsick\s+pay\b/i, questionType: "legal_advice", areaOfLaw: "sick_pay" },
  { pattern: /\bchange\s+(my\s+)?contract\b/i, questionType: "legal_advice", areaOfLaw: "contract_variation" },
  { pattern: /\b(maternity|paternity|adoption)\s+(leave|pay|right)/i, questionType: "legal_advice", areaOfLaw: "maternity" },
  { pattern: /\bflexible\s+working\b/i, questionType: "legal_advice", areaOfLaw: "flexible_working" },
  { pattern: /\bwages?\s+(deduct|withh)/i, questionType: "legal_advice", areaOfLaw: "wages_deduction" },
  { pattern: /\bwork(ing)?\s+(hours|time)\b/i, questionType: "legal_advice", areaOfLaw: "working_time" },
  { pattern: /\bminimum\s+wage\b/i, questionType: "legal_advice", areaOfLaw: "minimum_wage" },
  { pattern: /\btupe\b/i, questionType: "legal_advice", areaOfLaw: "tupe" },
  { pattern: /\b(dismissed|fired|sacked|terminated)\b/i, questionType: "legal_advice", areaOfLaw: "unfair_dismissal" },
];

function modelRoleFor(qt: RequestType): ModelRole {
  switch (qt) {
    case "document_review":
    case "settlement_review":
      return "uk_employment_document";
    case "grievance_draft":
    case "appeal_draft":
    case "document_generation":
    case "tribunal_form_help":
    case "disciplinary_response":
      return "uk_employment_drafting";
    case "legal_advice":
    case "deadline_check":
    case "risk_assessment":
    case "case_timeline":
      return "uk_employment_qa";
    case "unknown":
    default:
      return "fast_classifier";
  }
}

export function classifyRequest(input: { question?: string; mode?: string }): Classification {
  const q = (input.question ?? "").trim();

  let questionType: RequestType = "unknown";
  let areaOfLaw: AreaOfLaw = "unknown";

  if (q.length > 0) {
    for (const rule of RULES) {
      if (rule.pattern.test(q)) {
        questionType = rule.questionType;
        areaOfLaw = rule.areaOfLaw;
        break;
      }
    }
  }

  // Mode-derived fallbacks (only if regex didn't match anything specific).
  if (questionType === "unknown" && input.mode) {
    if (input.mode === "document_review") questionType = "document_review";
    else if (input.mode === "draft") questionType = "document_generation";
    else if (input.mode === "deadline") questionType = "deadline_check";
    else if (input.mode === "risk") questionType = "risk_assessment";
    else if (input.mode === "ask") questionType = "legal_advice";
  }

  const requiresDeadlineCheck =
    questionType === "deadline_check" ||
    areaOfLaw === "unfair_dismissal" ||
    areaOfLaw === "constructive_dismissal" ||
    areaOfLaw === "discrimination" ||
    areaOfLaw === "whistleblowing" ||
    areaOfLaw === "redundancy";

  return {
    question_type: questionType,
    area_of_law: areaOfLaw,
    jurisdiction: "England and Wales",
    requires_document:
      questionType === "document_review" ||
      questionType === "settlement_review" ||
      questionType === "document_generation",
    requires_deadline_check: requiresDeadlineCheck,
    requires_citations: true, // legal answers always require citations
    recommended_model_role: modelRoleFor(questionType),
  };
}
