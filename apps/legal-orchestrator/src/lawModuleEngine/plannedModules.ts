// Sprint 18 — Planned law modules.
//
// These declarations exist so the registry has a complete catalogue of the
// modules IterLaw intends to support. Every module here is `status: "planned"`
// and is REJECTED by the registry for legal-answer generation. They are
// scaffolding only.

import type { LawModule, LawArea, LawJurisdiction } from "./legalModule.types";

function plannedModule(
  moduleId: string,
  jurisdiction: LawJurisdiction,
  lawArea: LawArea,
  displayName: string,
  notes: string,
): LawModule {
  return {
    moduleId,
    jurisdiction,
    lawArea,
    displayName,
    status: "planned",
    ragNamespace: `iterlaw:rag:${moduleId}`,
    rulesNamespace: `iterlaw:rules:${moduleId}`,
    templatesNamespace: `iterlaw:templates:${moduleId}`,
    sourceTiers: [
      { tier: 1, label: "Primary legislation", grantsAnswer: true },
      { tier: 4, label: "Official guidance (GOV.UK / regulator)", grantsAnswer: true },
    ],
    citationPolicy: {
      citationRequired: true,
      zeroCitationAnswerBlocked: true,
      minSourceTierForAnswer: 4,
    },
    temporalPolicy: {
      excludeSuperseded: true,
      allowHistoricalComparison: false,
    },
    notes,
  };
}

export const PLANNED_LAW_MODULES: ReadonlyArray<LawModule> = [
  plannedModule(
    "uk_housing",
    "UK_ENGLAND_WALES",
    "housing",
    "UK Housing Law",
    "Planned. Scope: Housing Act 1988, Housing Act 2004, possession/eviction, deposits.",
  ),
  plannedModule(
    "uk_immigration",
    "UK",
    "immigration",
    "UK Immigration Law",
    "Planned. Scope: Immigration Rules HC 395, asylum, visas, settlement.",
  ),
  plannedModule(
    "uk_benefits",
    "UK",
    "benefits",
    "UK Benefits Law",
    "Planned. Scope: Universal Credit Regulations 2013, PIP, ESA, JSA, appeals.",
  ),
  plannedModule(
    "uk_debt",
    "UK_ENGLAND_WALES",
    "debt",
    "UK Debt / Insolvency Law",
    "Planned. Scope: CCA 1974, Insolvency Act 1986, IVA, bankruptcy, debt relief orders.",
  ),
  plannedModule(
    "uk_consumer",
    "UK",
    "consumer",
    "UK Consumer Law",
    "Planned. Scope: Consumer Rights Act 2015, CMA enforcement.",
  ),
  plannedModule(
    "uk_family",
    "UK_ENGLAND_WALES",
    "family",
    "UK Family Law",
    "Planned. Scope: Matrimonial Causes Act 1973, Children Act 1989, financial remedies.",
  ),
  plannedModule(
    "uk_business_contract",
    "UK_ENGLAND_WALES",
    "business_contract",
    "UK Business / Contract Law",
    "Planned. Scope: Sale of Goods, Misrep Act, contract formation, B2B disputes.",
  ),
  plannedModule(
    "uk_tax",
    "UK",
    "tax",
    "UK Tax Law",
    "Planned. Scope: ITA 2007, CTA 2009/2010, VATA 1994, HMRC guidance.",
  ),
];
