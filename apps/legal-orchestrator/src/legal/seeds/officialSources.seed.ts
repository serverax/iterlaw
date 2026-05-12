// Official UK employment-law sources seed.
//
// Every entry corresponds to one row in `legal_sources`. The list is
// closed: only the six Master-Order sources may appear. No external
// LLM provider, no third-party "law summarisers", no Wikipedia.

import type { LegalSourceInput } from "../types/legalSource.types";

export const officialLegalSourcesSeed: readonly LegalSourceInput[] = [
  {
    sourceType: "legislation",
    sourceName: "legislation.gov.uk",
    sourceUrl: "https://www.legislation.gov.uk",
    authorityTier: 100,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
  {
    sourceType: "govuk",
    sourceName: "GOV.UK Content API",
    sourceUrl: "https://www.gov.uk",
    authorityTier: 95,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
  {
    sourceType: "acas",
    sourceName: "ACAS",
    sourceUrl: "https://www.acas.org.uk",
    authorityTier: 90,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
  {
    sourceType: "ehrc",
    sourceName: "Equality and Human Rights Commission",
    sourceUrl: "https://www.equalityhumanrights.com",
    authorityTier: 90,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
  {
    sourceType: "hmcts",
    sourceName: "HMCTS Employment Tribunal Guidance",
    sourceUrl: "https://www.gov.uk/guidance/employment-tribunal-procedures",
    authorityTier: 90,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
  {
    sourceType: "case_law",
    sourceName: "Find Case Law",
    sourceUrl: "https://caselaw.nationalarchives.gov.uk",
    authorityTier: 95,
    jurisdiction: "england_wales",
    isOfficial: true,
  },
] as const;
