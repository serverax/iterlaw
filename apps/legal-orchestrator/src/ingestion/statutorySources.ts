// Seed registry of UK employment-law statutory sources.
//
// Hard rules:
//   * No scraping or fetching happens from this module — it is a typed
//     placeholder list consumed by the ingestion CLI dry-run and by the
//     rag-repository upsertLegalSource path.
//   * URLs are real, stable public references where known. They are NOT
//     guaranteed to be fetched in this sprint. If an exact URL is not
//     yet in the repo, a clearly-marked placeholder is used.
//   * No secrets, no credentials, no API keys.

export type RefreshFrequency = "monthly" | "quarterly" | "annual" | "on_amendment" | "ad_hoc";

export type EffectiveDateStrategy =
  | "uprate_annual_april"   // Statutory rates uprated each April (UK convention).
  | "uprate_annual_october" // NMW uprate is now April; pre-2024 was October.
  | "in_force_on_amendment" // Use legislation.gov.uk "version date" of the in-force amendment.
  | "decision_date"         // Tribunal/appeal decisions: effective from decision date.
  | "publication_date"      // ACAS / GOV.UK guidance: effective from published date.
  | "manual_review";        // Operator review required before applying a date.

export type StatutorySourceType =
  | "legislation"
  | "statutory_instrument"
  | "gov_guidance"
  | "acas_guidance"
  | "tribunal_case"
  | "appeal_case"
  | "case_law";

export interface StatutorySource {
  source_id: string;
  source_name: string;
  source_type: StatutorySourceType;
  jurisdiction: "uk" | "uk_ew" | "uk_sc" | "uk_ni";
  /** Real public URL where available. Marked as placeholder when not. */
  official_url: string;
  /** Hostname/origin we expect to fetch this from (used by assertUrlBelongsToSource). */
  expected_domain: string;
  refresh_frequency: RefreshFrequency;
  effective_date_strategy: EffectiveDateStrategy;
  /** Every ingested chunk from this source MUST be cited. */
  citation_required: boolean;
  notes: string;
}

export const STATUTORY_SOURCES: readonly StatutorySource[] = [
  {
    source_id: "uk-nmw-nlw",
    source_name: "National Minimum Wage / National Living Wage rates",
    source_type: "gov_guidance",
    jurisdiction: "uk",
    official_url: "https://www.gov.uk/national-minimum-wage-rates",
    expected_domain: "https://www.gov.uk",
    refresh_frequency: "annual",
    effective_date_strategy: "uprate_annual_april",
    citation_required: true,
    notes:
      "Hourly rates uprated each 1 April. Calculators reading this corpus must select the row whose effective_date <= work_period_start.",
  },
  {
    source_id: "uk-statutory-redundancy-pay",
    source_name: "Statutory redundancy pay — limits and calculation",
    source_type: "gov_guidance",
    jurisdiction: "uk",
    official_url: "https://www.gov.uk/redundant-your-rights/redundancy-pay",
    expected_domain: "https://www.gov.uk",
    refresh_frequency: "annual",
    effective_date_strategy: "uprate_annual_april",
    citation_required: true,
    notes:
      "Weekly-pay cap is uprated annually. Combined with the Employment Rights Act 1996 §162 multiplier table.",
  },
  {
    source_id: "uk-unfair-dismissal-cap",
    source_name: "Unfair dismissal compensatory award — cap",
    source_type: "gov_guidance",
    jurisdiction: "uk",
    official_url:
      "https://www.gov.uk/government/publications/employment-rights-act-1996-tribunal-awards-and-limits",
    expected_domain: "https://www.gov.uk",
    refresh_frequency: "annual",
    effective_date_strategy: "uprate_annual_april",
    citation_required: true,
    notes:
      "Annual order under ERA 1996 §227 sets the compensatory award cap. Underlying instrument is a statutory instrument; this guidance is the canonical summary.",
  },
  {
    source_id: "uk-era-1996",
    source_name: "Employment Rights Act 1996",
    source_type: "legislation",
    jurisdiction: "uk",
    official_url: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
    expected_domain: "https://www.legislation.gov.uk",
    refresh_frequency: "on_amendment",
    effective_date_strategy: "in_force_on_amendment",
    citation_required: true,
    notes:
      "Primary statute for unfair dismissal, redundancy, written statement, time off, ACAS EC, etc. Pull `/data.xml` per section for amendment-aware versioning.",
  },
  {
    source_id: "uk-eqa-2010",
    source_name: "Equality Act 2010",
    source_type: "legislation",
    jurisdiction: "uk",
    official_url: "https://www.legislation.gov.uk/ukpga/2010/15/contents",
    expected_domain: "https://www.legislation.gov.uk",
    refresh_frequency: "on_amendment",
    effective_date_strategy: "in_force_on_amendment",
    citation_required: true,
    notes:
      "Primary statute for discrimination, harassment, victimisation, equal pay. Versioned sections analogous to ERA 1996.",
  },
  {
    source_id: "uk-acas-code-disciplinary-grievance",
    source_name: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
    source_type: "acas_guidance",
    jurisdiction: "uk",
    official_url:
      "https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures",
    expected_domain: "https://www.acas.org.uk",
    refresh_frequency: "on_amendment",
    effective_date_strategy: "publication_date",
    citation_required: true,
    notes:
      "Statutory code under TULR(C)A 1992 §207. Failure to follow can adjust ET awards by ±25%. PDF + HTML editions are both published; prefer HTML for chunking.",
  },
  {
    source_id: "uk-vento-bands",
    source_name: "Vento bands — injury to feelings guidance (Presidents of ETs)",
    source_type: "tribunal_case",
    jurisdiction: "uk",
    official_url:
      "https://www.judiciary.uk/guidance-and-resources/employment-tribunal-presidential-guidance/",
    expected_domain: "https://www.judiciary.uk",
    refresh_frequency: "annual",
    effective_date_strategy: "uprate_annual_april",
    citation_required: true,
    notes:
      "Bands uprated by Presidential Guidance each April. Mapped onto uk_emp_rag.vento_band; orchestrator selects band by event_date.",
  },
  {
    source_id: "uk-et-rules-2013",
    source_name: "Employment Tribunal procedure rules (2013 Rules)",
    source_type: "statutory_instrument",
    jurisdiction: "uk",
    official_url: "https://www.legislation.gov.uk/uksi/2013/1237/contents/made",
    expected_domain: "https://www.legislation.gov.uk",
    refresh_frequency: "on_amendment",
    effective_date_strategy: "in_force_on_amendment",
    citation_required: true,
    notes:
      "SI 2013/1237 — Employment Tribunals (Constitution and Rules of Procedure) Regulations 2013. Cited heavily in time-limit, strike-out, costs cases.",
  },
  {
    source_id: "uk-cac-decisions",
    source_name: "Central Arbitration Committee decisions",
    source_type: "appeal_case",
    jurisdiction: "uk",
    official_url:
      "https://www.gov.uk/government/organisations/central-arbitration-committee",
    expected_domain: "https://www.gov.uk",
    refresh_frequency: "ad_hoc",
    effective_date_strategy: "decision_date",
    citation_required: true,
    notes:
      "Trade-union recognition + information / consultation decisions. Treat as appeal-level authority on collective-rights questions; lower than primary statute.",
  },
];

export function getStatutorySource(id: string): StatutorySource | undefined {
  return STATUTORY_SOURCES.find((s) => s.source_id === id);
}

export function listStatutorySources(filter?: {
  source_type?: StatutorySourceType;
  jurisdiction?: StatutorySource["jurisdiction"];
}): readonly StatutorySource[] {
  if (!filter) return STATUTORY_SOURCES;
  return STATUTORY_SOURCES.filter(
    (s) =>
      (filter.source_type === undefined || s.source_type === filter.source_type) &&
      (filter.jurisdiction === undefined || s.jurisdiction === filter.jurisdiction)
  );
}
