// Sprint 31 — Statutory rate sources + validation.
//
// Tightens the Sprint 21 `StatutoryRatesRegistry` shape with extra metadata
// every entry must carry before the redundancy calculator may use it:
//
//   - jurisdiction          (e.g. "UK_ENGLAND_WALES")
//   - rate_type             ("statutory_weekly_pay_cap" for now)
//   - amount                whole pounds, > 0
//   - currency              "GBP"
//   - effective_from        ISO date (inclusive)
//   - effective_to          ISO date (inclusive) | null = open-ended
//   - source_title          required, non-empty
//   - source_url            required, https://, ends with one of the trusted hosts
//   - verified_at           ISO date the operator verified the source on
//   - trust_score           0..1, must be > 0
//
// Pure validation. No network. No DB. No external LLM. No fabrication of
// rate values. **The registry ships EMPTY in product code** — operators
// supply entries from their own verified-source file.

import type { StatutoryWeeklyPayCapEntry } from "./statutoryRates";

export type CitedStatutoryRateType = "statutory_weekly_pay_cap";

export interface CitedStatutoryRateEntry {
  readonly jurisdiction: string;
  readonly rate_type: CitedStatutoryRateType;
  readonly amount: number;
  readonly currency: "GBP";
  readonly effective_from: string;
  readonly effective_to: string | null;
  readonly source_title: string;
  readonly source_url: string;
  readonly verified_at: string;
  readonly trust_score: number;
}

const TRUSTED_HOSTS = new Set([
  "www.legislation.gov.uk",
  "www.gov.uk",
  "www.acas.org.uk",
  "www.judiciary.uk",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type RateValidationFailure =
  | "missing_jurisdiction"
  | "missing_rate_type"
  | "amount_not_positive"
  | "currency_not_gbp"
  | "effective_from_not_iso"
  | "effective_to_not_iso"
  | "effective_window_inverted"
  | "missing_source_title"
  | "missing_source_url"
  | "source_url_not_https"
  | "source_url_not_trusted_host"
  | "missing_verified_at"
  | "verified_at_not_iso"
  | "trust_score_invalid";

export interface RateValidationResult {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<RateValidationFailure>;
}

export function validateCitedRateEntry(e: CitedStatutoryRateEntry): RateValidationResult {
  const failures: RateValidationFailure[] = [];
  if (!e.jurisdiction || e.jurisdiction.trim().length === 0) failures.push("missing_jurisdiction");
  if (!e.rate_type) failures.push("missing_rate_type");
  if (typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) failures.push("amount_not_positive");
  if (e.currency !== "GBP") failures.push("currency_not_gbp");
  if (!ISO_DATE.test(e.effective_from)) failures.push("effective_from_not_iso");
  if (e.effective_to !== null && !ISO_DATE.test(e.effective_to)) failures.push("effective_to_not_iso");
  if (e.effective_to !== null && ISO_DATE.test(e.effective_from) && ISO_DATE.test(e.effective_to) && e.effective_to < e.effective_from) {
    failures.push("effective_window_inverted");
  }
  if (!e.source_title || e.source_title.trim().length === 0) failures.push("missing_source_title");
  if (!e.source_url || e.source_url.length === 0) {
    failures.push("missing_source_url");
  } else {
    try {
      const u = new URL(e.source_url);
      if (u.protocol !== "https:") failures.push("source_url_not_https");
      if (!TRUSTED_HOSTS.has(u.hostname)) failures.push("source_url_not_trusted_host");
    } catch {
      failures.push("missing_source_url");
    }
  }
  if (!e.verified_at) failures.push("missing_verified_at");
  else if (!ISO_DATE.test(e.verified_at)) failures.push("verified_at_not_iso");
  if (typeof e.trust_score !== "number" || !Number.isFinite(e.trust_score) || e.trust_score <= 0 || e.trust_score > 1) {
    failures.push("trust_score_invalid");
  }
  return { ok: failures.length === 0, failures };
}

export interface RangesValidationResult {
  readonly ok: boolean;
  readonly overlaps: ReadonlyArray<{ first: number; second: number }>;
}

/**
 * Refuse a list of entries whose effective_from / effective_to windows
 * overlap. Open-ended `effective_to: null` is treated as +infinity for the
 * overlap calculation. Returns the indices of conflicting pairs.
 */
export function validateNoOverlappingRanges(entries: ReadonlyArray<CitedStatutoryRateEntry>): RangesValidationResult {
  const overlaps: Array<{ first: number; second: number }> = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.jurisdiction !== b.jurisdiction || a.rate_type !== b.rate_type) continue;
      const aStart = a.effective_from;
      const aEnd = a.effective_to ?? "9999-12-31";
      const bStart = b.effective_from;
      const bEnd = b.effective_to ?? "9999-12-31";
      if (aStart <= bEnd && bStart <= aEnd) {
        overlaps.push({ first: i, second: j });
      }
    }
  }
  return { ok: overlaps.length === 0, overlaps };
}

/**
 * Cited statutory rate registry. **Ships EMPTY by design.** IterLaw refuses
 * to invent rate values. Operators MUST add entries with real URLs that pass
 * `validateCitedRateEntry` and supply them to the calculator via the existing
 * `StatutoryRatesRegistry` shape (see `statutoryRates.ts`).
 *
 * To add a verified entry, prepare a fully populated CitedStatutoryRateEntry
 * elsewhere (e.g. in an operator-managed `*.cited-rates.ts` file outside the
 * repo or in a future operator-supplied seed sprint), run it through
 * `validateCitedRateEntry`, then transform to a StatutoryWeeklyPayCapEntry
 * via `citedToStatutoryWeeklyPayCap`.
 */
export const CITED_RATES_SEED: ReadonlyArray<CitedStatutoryRateEntry> = [];

/**
 * Convert a validated cited-rate entry into the calculator's
 * StatutoryWeeklyPayCapEntry shape. Refuses any input the validator
 * rejects.
 */
export function citedToStatutoryWeeklyPayCap(
  entry: CitedStatutoryRateEntry,
): StatutoryWeeklyPayCapEntry | { ok: false; failures: ReadonlyArray<RateValidationFailure> } {
  const v = validateCitedRateEntry(entry);
  if (!v.ok) return { ok: false, failures: v.failures };
  return {
    effectiveFrom: entry.effective_from,
    effectiveTo: entry.effective_to,
    amountGbp: entry.amount,
    source: entry.source_url,
    citationLabel: entry.source_title,
  };
}
