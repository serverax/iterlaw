// Sprint 21 — Versioned UK statutory rate registry.
//
// The redundancy pay calculator must apply the statutory weekly-pay cap that
// was in force at the effective date of dismissal (ERA 1996 s227). The cap
// changes annually and IterLaw refuses to invent rate values. This file ships
// with an EMPTY registry by design — operators / sprints must add rate entries
// only when they have an authoritative source URL (e.g. legislation.gov.uk for
// the Statutory Order or a GOV.UK official rate table) and have run the
// citation metadata gate against it.
//
// Pure types + pure helpers. No network. No DB. No external LLM.

export interface StatutoryWeeklyPayCapEntry {
  /** ISO date the cap takes effect (inclusive). */
  readonly effectiveFrom: string;
  /** ISO date the cap ceases to apply (inclusive). `null` = open-ended. */
  readonly effectiveTo: string | null;
  /** The cap in pounds sterling (whole pounds — pence are not allowed at this level). */
  readonly amountGbp: number;
  /** Citation URL. Required. */
  readonly source: string;
  /** Citation label for evidence packs. */
  readonly citationLabel: string;
}

export interface StatutoryRatesRegistry {
  readonly weeklyPayCaps: ReadonlyArray<StatutoryWeeklyPayCapEntry>;
}

/**
 * Default registry: EMPTY by design. IterLaw refuses to invent statutory
 * weekly-pay cap values. To enable the calculator in a given environment,
 * supply a registry with cap entries each carrying a real source URL.
 */
export function defaultStatutoryRatesRegistry(): StatutoryRatesRegistry {
  return { weeklyPayCaps: [] };
}

/**
 * Find the statutory weekly-pay cap that applies on a specific ISO date.
 * Returns `undefined` when no entry covers the date.
 *
 * Comparison is purely lexicographic on ISO YYYY-MM-DD strings (safe).
 */
export function findStatutoryWeeklyPayCap(
  registry: StatutoryRatesRegistry,
  effectiveDateIso: string,
): StatutoryWeeklyPayCapEntry | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(effectiveDateIso)) return undefined;
  const date = effectiveDateIso.slice(0, 10);
  return registry.weeklyPayCaps.find((entry) => {
    if (date < entry.effectiveFrom) return false;
    if (entry.effectiveTo !== null && date > entry.effectiveTo) return false;
    return true;
  });
}
