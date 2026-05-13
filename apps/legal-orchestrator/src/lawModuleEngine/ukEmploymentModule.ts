// Sprint 18 — UK Employment Law Module (active).

import type { LawModule } from "./legalModule.types";

export const UK_EMPLOYMENT_MODULE: LawModule = {
  moduleId: "uk_employment",
  jurisdiction: "UK_ENGLAND_WALES",
  lawArea: "employment",
  displayName: "UK Employment Law",
  status: "active",
  ragNamespace: "iterlaw:rag:uk_employment",
  rulesNamespace: "iterlaw:rules:uk_employment",
  templatesNamespace: "iterlaw:templates:uk_employment",
  sourceTiers: [
    { tier: 1, label: "Primary legislation (ERA 1996, Eq Act 2010, etc.)", grantsAnswer: true },
    { tier: 2, label: "Secondary legislation / statutory instruments", grantsAnswer: true },
    { tier: 3, label: "Tribunal / case law (EAT, Court of Appeal, Supreme Court)", grantsAnswer: true },
    { tier: 4, label: "GOV.UK / ACAS official guidance", grantsAnswer: true },
    { tier: 5, label: "Professional / academic commentary", grantsAnswer: false },
  ],
  citationPolicy: {
    citationRequired: true,
    zeroCitationAnswerBlocked: true,
    minSourceTierForAnswer: 4,
  },
  temporalPolicy: {
    effectiveDateMin: "1996-01-01",
    excludeSuperseded: true,
    allowHistoricalComparison: false,
  },
  notes:
    "First active IterLaw module. Scope: England & Wales employment law. " +
    "Other UK nations (Scotland, Northern Ireland) require separate modules. " +
    "Calculators: redundancy pay, notice, holiday pay, NMW/NLW, unfair dismissal cap, Vento bands.",
};
