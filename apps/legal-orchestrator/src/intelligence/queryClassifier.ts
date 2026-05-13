// Sprint 14 — Query classifier (pure, deterministic, keyword-driven).
//
// Mock-safe: returns a QueryIntent + reason codes for any input string.
// NEVER calls an LLM, NEVER reaches a database. A future sprint can
// swap in a small classifier model; the contract above must be
// preserved.

import type { QueryIntent } from "./intelligence.types";

interface RuleHit {
  intent: QueryIntent;
  reason: string;
}

const RULES: Array<{ pattern: RegExp; intent: QueryIntent; reason: string }> = [
  { pattern: /\b(unfair dismissal|dismissed|redundancy|holiday pay|notice pay|discriminat|tribunal|acas|ERA 1996|Equality Act|whistleblow|protected disclosure|settlement agreement|right to work|tribunal deadline|limitation date)\b/i,
    intent: "legal_question", reason: "matched_legal_keyword" },
  { pattern: /\b(sprint|roadmap|PROJECT\.md|status|backlog|burn ?down|milestone)\b/i,
    intent: "project_status", reason: "matched_project_status_keyword" },
  { pattern: /\b(architecture|ADR|RAG design|module pipeline|hexagonal|microservice|namespace|topology|service mesh)\b/i,
    intent: "technical_architecture", reason: "matched_architecture_keyword" },
  { pattern: /\b(threat|risk|CVE|vulnerab|exploit|attack surface|RBAC|RLS|secret leak|prompt injection|supply chain)\b/i,
    intent: "security_risk", reason: "matched_security_keyword" },
  { pattern: /\b(deploy|kubectl|helm|production|staging|rollout|release branch|cluster)\b/i,
    intent: "deployment", reason: "matched_deployment_keyword" },
  { pattern: /\b(price|pricing|cost|subscription|plan|tier|invoice|billing)\b/i,
    intent: "billing_or_pricing", reason: "matched_billing_keyword" },
  { pattern: /\b(refund|complaint|chargeback|ticket|outage|customer)\b/i,
    intent: "customer_support", reason: "matched_support_keyword" },
  { pattern: /\b(write code|implement|refactor|TypeScript snippet|function that|class that|generate code)\b/i,
    intent: "code_generation", reason: "matched_code_generation_keyword" },
  { pattern: /\b(GDPR|DPA 2018|UK GDPR|Data \(Use and Access\)|PII|consent|retention policy|compliance)\b/i,
    intent: "compliance", reason: "matched_compliance_keyword" },
];

export function classifyQuery(question: string): {
  intent: QueryIntent;
  reason_codes: string[];
} {
  const reason_codes: string[] = [];
  const hits: RuleHit[] = [];

  for (const r of RULES) {
    if (r.pattern.test(question)) {
      hits.push({ intent: r.intent, reason: r.reason });
    }
  }

  if (hits.length === 0) {
    return {
      intent: "unknown",
      reason_codes: ["no_rule_matched", "fallback_unknown"],
    };
  }

  // Highest-priority intent wins: legal_question > compliance > security_risk
  // > deployment > technical_architecture > project_status > billing_or_pricing
  // > customer_support > code_generation > unknown.
  const priority: QueryIntent[] = [
    "legal_question",
    "compliance",
    "security_risk",
    "deployment",
    "technical_architecture",
    "project_status",
    "billing_or_pricing",
    "customer_support",
    "code_generation",
    "unknown",
  ];

  for (const p of priority) {
    const matched = hits.find((h) => h.intent === p);
    if (matched) {
      for (const h of hits) reason_codes.push(h.reason);
      reason_codes.push(`priority_winner:${p}`);
      return { intent: p, reason_codes };
    }
  }

  return { intent: "unknown", reason_codes: ["fallback_unknown"] };
}
