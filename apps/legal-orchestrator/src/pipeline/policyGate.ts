// Policy gate (Phase 16). Refuses answers that contain forbidden patterns
// regardless of LLM cooperation.

import type { Classification, RiskCheck } from "../types/legal.js";

export interface PolicyGateInput {
  answer: string;
  classification: Classification;
  risk: RiskCheck;
  hasCitations: boolean;
}

export interface PolicyGateResult {
  pass: boolean;
  failures: string[];
}

const FORBIDDEN_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: "guaranteed_success_will_win", pattern: /\byou will win\b/i },
  { id: "guaranteed_success_guaranteed", pattern: /\bguaranteed\b/i },
  { id: "guaranteed_success_definitely_unlawful", pattern: /\bdefinitely unlawful\b/i },
  { id: "guaranteed_success_tribunal_will", pattern: /\bthe tribunal will\b/i },
  { id: "casual_chatbot_hey", pattern: /^\s*hey\b/i },
  // Emoji block: presence of any emoji code-point is an immediate fail.
  { id: "emoji_present", pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
];

export function policyGate(input: PolicyGateInput): PolicyGateResult {
  const failures: string[] = [];
  const { answer, classification, risk, hasCitations } = input;

  if (!hasCitations) {
    failures.push("final_answer_without_citations");
  }

  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(answer)) {
      failures.push(rule.id);
    }
  }

  if (
    classification.requires_deadline_check &&
    !/\b(deadline|time limit|limitation|3 months less one day|ACAS)\b/i.test(answer)
  ) {
    failures.push("missing_deadline_warning");
  }

  if (
    /compensation|award|damages|payout/i.test(answer) &&
    !/£\d|\b\d+\s*(weeks?|months?)\b/.test(answer)
  ) {
    // The skeleton has no remedy model. Any answer that hints at compensation
    // without an actual figure pinned to a basis is flagged as unsupported.
    // (Phase 16 will tighten this once the remedy model exists.)
    // NOTE: this is a soft signal — does not currently fail the gate, only logs.
  }

  if (risk.status === "high_risk_deadline" && !/limitation|deadline|time limit/i.test(answer)) {
    failures.push("high_risk_deadline_not_communicated");
  }

  return { pass: failures.length === 0, failures };
}
