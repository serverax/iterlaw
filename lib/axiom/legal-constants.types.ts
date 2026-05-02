/**
 * Versioned legal constant — single source of truth for caps, rates, and bands.
 * Engines (e.g. compensation-engine) must read rows at runtime; do not duplicate
 * numeric policy in TypeScript literals for production paths.
 *
 * Northern Ireland and other jurisdictions require their own rows; never infer
 * from england_wales.
 */
export type JurisdictionCode = 'england_wales' | 'northern_ireland' | 'scotland';

/** jsonb: number | { min: number; max: number } | boolean | structured rule object */
export type LegalConstantValue = number | Record<string, unknown> | boolean;

export interface LegalConstantRow {
  id: string;
  key: string;
  jurisdiction: JurisdictionCode;
  value: LegalConstantValue;
  effective_from: string;
  effective_to: string | null;
  source_url: string;
  source_citation: string;
  reviewed_by: string;
  reviewed_at: string;
}
