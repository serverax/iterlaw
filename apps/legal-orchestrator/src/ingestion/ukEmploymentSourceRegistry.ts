// Sprint 20 — UK Employment module source registry (foundation).
//
// Trusted-source allowlist for the UK Employment law module. Composed of:
//   - canonical hostnames (allowlist)
//   - source categories (statutory, gov guidance, ACAS, tribunal, judiciary)
//   - source tier ordering
//
// Pure data + pure helpers. No network. No DB. No external LLM. No mutation.

export type UkEmploymentSourceCategory =
  | "primary_legislation"     // legislation.gov.uk Acts of Parliament
  | "secondary_legislation"   // legislation.gov.uk SIs
  | "gov_guidance"            // GOV.UK official employment guidance
  | "acas_guidance"           // ACAS official guidance
  | "et_decision"             // Employment Tribunal decisions (GOV.UK / National Archives)
  | "eat_decision"            // Employment Appeal Tribunal decisions
  | "court_decision"          // Court of Appeal, Supreme Court (judiciary.uk / BAILII)
  | "judiciary_guidance"      // Vento bands, Presidential Guidance, etc.
  | "statutory_rate";         // statutory rates / caps (only when an official source exists)

export interface UkEmploymentTrustedHost {
  readonly host: string;
  readonly category: UkEmploymentSourceCategory;
  readonly tier: number;
  readonly notes: string;
}

const HOSTS: ReadonlyArray<UkEmploymentTrustedHost> = [
  {
    host: "www.legislation.gov.uk",
    category: "primary_legislation",
    tier: 1,
    notes: "Acts of Parliament (e.g. ERA 1996, Eq Act 2010) + Statutory Instruments (SIs).",
  },
  {
    host: "www.gov.uk",
    category: "gov_guidance",
    tier: 4,
    notes: "Official UK government employment guidance pages.",
  },
  {
    host: "www.acas.org.uk",
    category: "acas_guidance",
    tier: 4,
    notes: "ACAS official guidance + Code of Practice on disciplinary and grievance procedures.",
  },
  {
    host: "www.judiciary.uk",
    category: "judiciary_guidance",
    tier: 3,
    notes: "Presidential Guidance (incl. Vento bands), judicial guidance.",
  },
  {
    host: "www.bailii.org",
    category: "court_decision",
    tier: 3,
    notes: "Reported case law from EAT, Court of Appeal, Supreme Court (BAILII archive).",
  },
  {
    host: "caselaw.nationalarchives.gov.uk",
    category: "court_decision",
    tier: 3,
    notes: "Find Case Law (National Archives) — official UK court judgments.",
  },
];

const HOST_INDEX: ReadonlyMap<string, UkEmploymentTrustedHost> = new Map(
  HOSTS.map((h) => [h.host, h]),
);

export function listUkEmploymentTrustedHosts(): ReadonlyArray<UkEmploymentTrustedHost> {
  return HOSTS;
}

export function findUkEmploymentTrustedHost(host: string): UkEmploymentTrustedHost | undefined {
  if (typeof host !== "string") return undefined;
  return HOST_INDEX.get(host.toLowerCase().trim());
}

/** Sorted tier order (1 = highest authority). Stable. */
export function listUkEmploymentSourceTiers(): ReadonlyArray<UkEmploymentSourceCategory> {
  return [
    "primary_legislation",
    "secondary_legislation",
    "court_decision",
    "judiciary_guidance",
    "eat_decision",
    "et_decision",
    "gov_guidance",
    "acas_guidance",
    "statutory_rate",
  ];
}
