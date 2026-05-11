// policyGate — refuses answers that contain forbidden patterns or
// fail required-phrase checks per the active legal pack.

import type {
  LegalPackContext,
  PolicyGateInput,
  PolicyGateOutput,
} from "./contracts";

function compile(pattern: string, flags?: string): RegExp {
  return new RegExp(pattern, flags ?? "");
}

export function policyGateModule(
  input: PolicyGateInput,
  ctx: LegalPackContext
): PolicyGateOutput {
  const failures: string[] = [];
  const blocked: string[] = [];
  const { answer_text, classification, risk_check, has_citations } = input;

  if (!has_citations) {
    failures.push("final_answer_without_citations");
  }

  for (const rule of ctx.ruleset.forbidden_terms) {
    let re: RegExp;
    try {
      re = compile(rule.pattern, rule.flags);
    } catch {
      // A malformed legal-pack regex should never crash the gate.
      continue;
    }
    if (re.test(answer_text)) {
      blocked.push(rule.id);
      failures.push(rule.id);
    }
  }

  if (classification.requires_deadline_check) {
    const requiredPhrases = ctx.ruleset.required_phrases_when_deadline_relevant;
    const found = requiredPhrases.some((p) =>
      new RegExp(`\\b${p.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(answer_text)
    );
    if (!found) failures.push("missing_deadline_warning");
  }

  if (
    risk_check.status === "high_risk_deadline" &&
    !/limitation|deadline|time limit/i.test(answer_text)
  ) {
    failures.push("high_risk_deadline_not_communicated");
  }

  return {
    pass: failures.length === 0,
    blocked_terms: blocked,
    failures,
  };
}
