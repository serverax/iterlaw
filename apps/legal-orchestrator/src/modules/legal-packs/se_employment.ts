import type { LegalPackContext, LegalPackRuleset } from "../contracts";

// Placeholder Swedish employment-law ruleset. Demonstrates the shape so a
// real ruleset can be slotted in without changing the module code.
// Values here are conservative defaults — they DO NOT represent live
// Swedish law and must not be relied on for any actual answer.

export const SE_EMPLOYMENT_RULESET: LegalPackRuleset = {
  area_of_law_to_rule_ids: {},
  rules: {},
  forbidden_terms: [
    // Reuse generic safety terms; Swedish-language additions go here later.
    { id: "guaranteed_you_will_win_en", pattern: "\\byou will win\\b", flags: "i" },
    { id: "guaranteed_du_kommer_vinna", pattern: "\\bdu kommer (att )?vinna\\b", flags: "i" },
    {
      id: "emoji_present",
      pattern: "[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]",
      flags: "u",
    },
  ],
  required_phrases_when_deadline_relevant: [
    "deadline",
    "preskription",
    "tidsfrist",
  ],
  // Sweden: under LAS, dismissal claims are typically subject to a
  // notification within 2 weeks and proceedings within 2 months. These
  // numbers are placeholders; do not rely on them until verified.
  limitation_window_days: 60,
  qualifying_service_months_unfair_dismissal: 0,
  no_qualifying_service_areas: [],
};

export const SE_EMPLOYMENT_CONTEXT: LegalPackContext = {
  legal_pack: "se_employment",
  jurisdiction: "se",
  ruleset: SE_EMPLOYMENT_RULESET,
};
