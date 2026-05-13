// Sprint 18 — Law Module Engine types.
//
// A "law module" is a (jurisdiction, law area) cell in the registry. Each module
// owns its own RAG namespace, rules namespace, templates namespace, source tiers,
// citation policy, and temporal policy. Only modules with `status: "active"` may
// be used to generate legal answers. All other modules are PLANNED.
//
// This file declares types only. No runtime behaviour, no network, no DB.

export type LawJurisdiction =
  | "UK"
  | "UK_ENGLAND_WALES"
  | "UK_SCOTLAND"
  | "UK_NORTHERN_IRELAND";

export type LawArea =
  | "employment"
  | "housing"
  | "immigration"
  | "benefits"
  | "debt"
  | "consumer"
  | "family"
  | "business_contract"
  | "tax";

export type LawModuleStatus = "active" | "planned" | "inactive";

export interface SourceTier {
  /** Stable tier identifier. 1 = highest authority (primary legislation). */
  readonly tier: number;
  /** Short human-readable label, e.g. "Primary legislation". */
  readonly label: string;
  /** Whether content from this tier can ground a legal answer on its own. */
  readonly grantsAnswer: boolean;
}

export interface CitationPolicy {
  /** Citations are required for every legal answer. Must remain true. */
  readonly citationRequired: true;
  /** Zero citations means no answer. Must remain true. */
  readonly zeroCitationAnswerBlocked: true;
  /** Minimum source-tier rank that counts toward citation_required (1 = strict). */
  readonly minSourceTierForAnswer: number;
}

export interface TemporalPolicy {
  /** Reject sources whose effective-date is before this ISO date. */
  readonly effectiveDateMin?: string;
  /** When true, superseded sources are excluded from a fresh answer. */
  readonly excludeSuperseded: true;
  /** When true, a historical-comparison mode may include superseded sources. */
  readonly allowHistoricalComparison: boolean;
}

export interface LawModule {
  readonly moduleId: string;
  readonly jurisdiction: LawJurisdiction;
  readonly lawArea: LawArea;
  readonly displayName: string;
  readonly status: LawModuleStatus;
  readonly ragNamespace: string;
  readonly rulesNamespace: string;
  readonly templatesNamespace: string;
  readonly sourceTiers: ReadonlyArray<SourceTier>;
  readonly citationPolicy: CitationPolicy;
  readonly temporalPolicy: TemporalPolicy;
  /** Free-text note explaining the module's scope. */
  readonly notes: string;
}

export type LawModuleLookupKey =
  | { moduleId: string }
  | { jurisdiction: LawJurisdiction; lawArea: LawArea };

export interface LawModuleLookupError {
  readonly kind:
    | "unknown_module"
    | "inactive_module"
    | "invalid_lookup_key"
    | "ambiguous_match";
  readonly reason: string;
}

export type LawModuleLookupResult =
  | { ok: true; module: LawModule }
  | { ok: false; error: LawModuleLookupError };
