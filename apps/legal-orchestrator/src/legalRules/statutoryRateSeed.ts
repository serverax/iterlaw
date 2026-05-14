// Sprint 37 — Cited statutory rate seed ingestion.
//
// Builds on Sprint 31's `statutoryRateSources.ts`. Provides a single
// `ingestCitedStatutoryRateSeed(entries)` entry point that:
//
//   1. validates every candidate against `validateCitedRateEntry`,
//   2. refuses duplicate keys (same jurisdiction + rate_type + effective_from),
//   3. refuses overlapping effective windows (re-uses
//      `validateNoOverlappingRanges`),
//   4. transforms valid entries into the calculator's
//      `StatutoryWeeklyPayCapEntry` shape via `citedToStatutoryWeeklyPayCap`,
//   5. returns either a fully-validated `StatutoryRatesRegistry` ready for
//      the redundancy calculator OR a structured failure listing the
//      offending entries — never throws.
//
// Pure function. No network. No DB. No external LLM. **No rate values
// are invented in product code.**

import {
  validateCitedRateEntry,
  validateNoOverlappingRanges,
  citedToStatutoryWeeklyPayCap,
  type CitedStatutoryRateEntry,
  type RateValidationFailure,
} from "./statutoryRateSources";
import type {
  StatutoryRatesRegistry,
  StatutoryWeeklyPayCapEntry,
} from "./statutoryRates";

export interface SeedIngestionPerEntryFailure {
  readonly index: number;
  readonly reasons: ReadonlyArray<RateValidationFailure | "duplicate_key">;
}

export type SeedIngestionResult =
  | {
      readonly ok: true;
      readonly registry: StatutoryRatesRegistry;
      readonly accepted: number;
      readonly reasonCodes: ReadonlyArray<string>;
    }
  | {
      readonly ok: false;
      readonly reasonCodes: ReadonlyArray<string>;
      readonly perEntryFailures: ReadonlyArray<SeedIngestionPerEntryFailure>;
      readonly overlapPairs: ReadonlyArray<{ first: number; second: number }>;
    };

function dedupKey(e: CitedStatutoryRateEntry): string {
  return `${e.jurisdiction}::${e.rate_type}::${e.effective_from}`;
}

export function ingestCitedStatutoryRateSeed(
  entries: ReadonlyArray<CitedStatutoryRateEntry>,
): SeedIngestionResult {
  // 1. Per-entry validation.
  const perEntryFailures: SeedIngestionPerEntryFailure[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i]!;
    const v = validateCitedRateEntry(e);
    if (!v.ok) {
      perEntryFailures.push({ index: i, reasons: v.failures });
    }
  }

  // 2. Duplicate-key detection (run regardless so callers can see all errors).
  const seenKeys = new Map<string, number>();
  for (let i = 0; i < entries.length; i += 1) {
    const key = dedupKey(entries[i]!);
    if (seenKeys.has(key)) {
      const existing = perEntryFailures.find((f) => f.index === i);
      if (existing) {
        (existing.reasons as Array<RateValidationFailure | "duplicate_key">).push("duplicate_key");
      } else {
        perEntryFailures.push({ index: i, reasons: ["duplicate_key"] });
      }
    } else {
      seenKeys.set(key, i);
    }
  }

  // 3. Range overlap detection (only on per-entry-valid entries).
  const validEntries = entries.filter((_e, i) => !perEntryFailures.some((f) => f.index === i));
  const overlap = validateNoOverlappingRanges(validEntries);

  if (perEntryFailures.length > 0 || !overlap.ok) {
    const reasonCodes: string[] = ["seed_ingest:refused"];
    if (perEntryFailures.length > 0) reasonCodes.push(`seed_ingest:per_entry_failures:${perEntryFailures.length}`);
    if (!overlap.ok) reasonCodes.push(`seed_ingest:overlap_pairs:${overlap.overlaps.length}`);
    return {
      ok: false,
      reasonCodes,
      perEntryFailures,
      overlapPairs: overlap.overlaps,
    };
  }

  // 4. Transform into calculator shape.
  const weeklyPayCaps: StatutoryWeeklyPayCapEntry[] = [];
  for (const e of validEntries) {
    const out = citedToStatutoryWeeklyPayCap(e);
    if ("ok" in out && out.ok === false) {
      // Should not happen — `validateCitedRateEntry` already passed.
      // Belt-and-braces: surface as overall refusal.
      return {
        ok: false,
        reasonCodes: ["seed_ingest:transform_failed"],
        perEntryFailures: [],
        overlapPairs: [],
      };
    }
    weeklyPayCaps.push(out as StatutoryWeeklyPayCapEntry);
  }

  const reasonCodes: string[] = ["seed_ingest:ok", `seed_ingest:accepted:${weeklyPayCaps.length}`];
  if (weeklyPayCaps.length === 0) {
    reasonCodes.push("seed_ingest:empty_seed_no_production_claim");
  }
  return {
    ok: true,
    registry: { weeklyPayCaps },
    accepted: weeklyPayCaps.length,
    reasonCodes,
  };
}

/**
 * Pick the entry whose window covers the supplied ISO date.
 * Returns `undefined` if no entry covers it; callers must surface a
 * `needs_verified_rate` outcome in that case (the redundancy calculator
 * already does this — see `findStatutoryWeeklyPayCap`).
 *
 * Helpful for ad-hoc inspection / dry-run reporting alongside the
 * calculator.
 */
export function selectCapForDate(
  registry: StatutoryRatesRegistry,
  isoDate: string,
): StatutoryWeeklyPayCapEntry | undefined {
  if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return undefined;
  const date = isoDate.slice(0, 10);
  return registry.weeklyPayCaps.find((entry) => {
    if (date < entry.effectiveFrom) return false;
    if (entry.effectiveTo !== null && date > entry.effectiveTo) return false;
    return true;
  });
}
