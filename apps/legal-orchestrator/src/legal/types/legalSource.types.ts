// Legal source types — describes an upstream authority for IterLaw.
// One row in the `legal_sources` table per real-world authority.

export type SourceType =
  | "legislation"
  | "govuk"
  | "acas"
  | "ehrc"
  | "hmcts"
  | "case_law";

/** Numeric tier matching the migration's `authority_tier` column.
 *  Higher = more authoritative. Tiers are advisory — the algorithm
 *  layer combines tier with recency and citation weight. */
export type AuthorityTier = number;

export interface LegalSource {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  authorityTier: AuthorityTier;
  jurisdiction: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface LegalSourceInput {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  authorityTier: AuthorityTier;
  jurisdiction?: string;
  isOfficial?: boolean;
}
