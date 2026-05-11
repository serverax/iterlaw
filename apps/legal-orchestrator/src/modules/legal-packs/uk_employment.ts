import type { LegalPackContext, LegalPackRuleset, RuleDefinition } from "../contracts";

const RULES: Record<string, RuleDefinition> = {
  unfair_dismissal_missing_dismissal_date: {
    id: "unfair_dismissal_missing_dismissal_date",
    description: "Unfair-dismissal questions require a dismissal_date.",
    predicate: { kind: "fact_missing", fact: "dismissal_date" },
    on_match: [{ kind: "mark_missing_fact", value: "dismissal_date" }],
  },
  constructive_dismissal_missing_dismissal_date: {
    id: "constructive_dismissal_missing_dismissal_date",
    description: "Constructive-dismissal questions require a dismissal_date (date of resignation).",
    predicate: { kind: "fact_missing", fact: "dismissal_date" },
    on_match: [{ kind: "mark_missing_fact", value: "dismissal_date" }],
  },
  discrimination_missing_incident_date: {
    id: "discrimination_missing_incident_date",
    description: "Discrimination questions require an incident_date.",
    predicate: { kind: "fact_missing", fact: "incident_date" },
    on_match: [{ kind: "mark_missing_fact", value: "incident_date" }],
  },
  whistleblowing_missing_incident_date: {
    id: "whistleblowing_missing_incident_date",
    description: "Whistleblowing questions require an incident_date.",
    predicate: { kind: "fact_missing", fact: "incident_date" },
    on_match: [{ kind: "mark_missing_fact", value: "incident_date" }],
  },
  suspension_missing_suspension_date: {
    id: "suspension_missing_suspension_date",
    description: "Suspension questions require a suspension_date.",
    predicate: { kind: "fact_missing", fact: "suspension_date" },
    on_match: [
      { kind: "mark_missing_fact", value: "suspension_date" },
      { kind: "rule_hit", value: "suspension_basis_check" },
    ],
  },
  acas_ec_required: {
    id: "acas_ec_required",
    description: "ACAS Early Conciliation is required before most ET claims.",
    predicate: { kind: "fact_equals", fact: "acas_started", value: false },
    on_match: [
      { kind: "rule_hit", value: "acas_ec_required" },
      {
        kind: "warning",
        value:
          "ACAS Early Conciliation is required before lodging most Employment Tribunal claims.",
      },
    ],
  },
};

export const UK_EMPLOYMENT_RULESET: LegalPackRuleset = {
  area_of_law_to_rule_ids: {
    unfair_dismissal: ["unfair_dismissal_missing_dismissal_date", "acas_ec_required"],
    constructive_dismissal: [
      "constructive_dismissal_missing_dismissal_date",
      "acas_ec_required",
    ],
    discrimination: ["discrimination_missing_incident_date", "acas_ec_required"],
    whistleblowing: ["whistleblowing_missing_incident_date", "acas_ec_required"],
    suspension: ["suspension_missing_suspension_date"],
  },
  rules: RULES,
  forbidden_terms: [
    { id: "guaranteed_you_will_win", pattern: "\\byou will win\\b", flags: "i" },
    { id: "guaranteed_guaranteed", pattern: "\\bguaranteed\\b", flags: "i" },
    { id: "guaranteed_definitely_unlawful", pattern: "\\bdefinitely unlawful\\b", flags: "i" },
    { id: "guaranteed_tribunal_will", pattern: "\\bthe tribunal will\\b", flags: "i" },
    { id: "casual_chatbot_hey", pattern: "^\\s*hey\\b", flags: "i" },
    // Emoji range (single source of truth here so the WASM port can reuse it)
    {
      id: "emoji_present",
      pattern: "[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]",
      flags: "u",
    },
  ],
  required_phrases_when_deadline_relevant: [
    "deadline",
    "time limit",
    "limitation",
    "3 months less one day",
    "ACAS",
  ],
  limitation_window_days: 91, // 3 months less one day in UK
  qualifying_service_months_unfair_dismissal: 24,
  no_qualifying_service_areas: ["discrimination", "whistleblowing", "harassment", "victimisation"],
};

export const UK_EMPLOYMENT_CONTEXT: LegalPackContext = {
  legal_pack: "uk_employment_england_wales",
  jurisdiction: "uk_ew",
  ruleset: UK_EMPLOYMENT_RULESET,
};
