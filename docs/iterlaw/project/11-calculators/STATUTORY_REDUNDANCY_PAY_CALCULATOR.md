# Statutory Redundancy Pay Calculator (UK Employment)

**Sprint 21 — implemented (deterministic, source-required).**

## Statutory basis

- **ERA 1996 s162** — calculation rules:
  - For each full year of service:
    - aged 41+ during that year → 1.5 week's pay
    - aged 22–40 during that year → 1.0 week's pay
    - aged under 22 during that year → 0.5 week's pay
  - Max 20 years of service counted (s162(3)).
  - Only full years count (s162(1)).
- **ERA 1996 s227** — statutory weekly-pay cap; revised annually. Weekly pay is capped at the cap in force on the effective date of dismissal.

## Implementation files

- `apps/legal-orchestrator/src/legalRules/redundancyPayCalculator.ts`
- `apps/legal-orchestrator/src/legalRules/statutoryRates.ts`
- `apps/legal-orchestrator/src/tests/redundancyPayCalculator.test.ts` — 15 vitest cases.

## Public surface

```ts
calculateStatutoryRedundancyPay(
  input: {
    ageAtDismissal: number;       // whole years, >= 16
    yearsOfService: number;        // truncated to full years
    weeklyPayGbp: number;          // > 0
    effectiveDate: string;         // ISO YYYY-MM-DD
  },
  opts: { ratesRegistry: StatutoryRatesRegistry },
): RedundancyPayOutcome;
```

## Refusal contract

- **No cap for the effective date** → `{ ok: false, reason: "needs_verified_rate", missingFor: "<date>" }`. The calculator never invents a cap.
- **Invalid input** (age below 16, negative service, non-positive weekly pay, non-ISO date) → `{ ok: false, reason: "invalid_input", violations: [...] }`.

## Rates registry

`statutoryRates.ts` exports `defaultStatutoryRatesRegistry()` which returns an **empty** `weeklyPayCaps` array. Operators / future sprints must add entries — each entry requires a real `source` URL pointing at `legislation.gov.uk` or `gov.uk`. IterLaw refuses to ship hard-coded rate values that are not externally citeable.

A rate entry has the shape:

```ts
{
  effectiveFrom: "2024-04-06",        // ISO date the cap takes effect (inclusive)
  effectiveTo:   "2025-04-05",        // ISO date the cap ceases to apply (inclusive); null = open-ended
  amountGbp:     700,                  // cap in pounds sterling (whole pounds)
  source:        "https://www.legislation.gov.uk/...",
  citationLabel: "...",
}
```

## Age-walk convention (documented)

Walking back from termination: for year `i` (where `i = 0` is the most recent year of service), the age applied is `ageAtDismissal - i`. This is the age the worker reached during that year — the conservative reading of s162(2) consistent with the GOV.UK redundancy pay calculator. The convention is asserted by tests `45-year-old, 10 years service ... = 12.5 weeks` and `21-year-old, 4 years service ... = 2 weeks`.

## Output

```ts
{
  ok: true,
  input: <original input>,
  capAppliedGbp: number,
  cappedWeeklyPayGbp: number,
  cappedYearsOfService: number,
  ageBandBreakdown: {
    yearsAtBand_under22: number,
    yearsAtBand_22_to_40: number,
    yearsAtBand_41_plus: number,
  },
  totalWeeks: number,
  totalStatutoryPayGbp: number,         // rounded to 2dp
  source: <StatutoryWeeklyPayCapEntry>,
  assumptions: string[],
  warnings: string[],
  reasonCodes: string[],
}
```

## Sprint 31 — cited statutory rate sources (PARTIAL)

`apps/legal-orchestrator/src/legalRules/statutoryRateSources.ts` adds:

- `CitedStatutoryRateEntry` — strict shape (`jurisdiction`, `rate_type`, `amount`, `currency`, `effective_from`, `effective_to`, `source_title`, `source_url`, `verified_at`, `trust_score`).
- `validateCitedRateEntry(e)` — rejects missing source metadata, non-https URLs, untrusted hosts (must be one of `www.legislation.gov.uk`, `www.gov.uk`, `www.acas.org.uk`, `www.judiciary.uk`), trust_score outside (0, 1], inverted windows, non-ISO dates.
- `validateNoOverlappingRanges(entries)` — rejects overlapping windows for the same `(jurisdiction, rate_type)` pair. Open-ended `effective_to: null` treated as +∞.
- `citedToStatutoryWeeklyPayCap(entry)` — converts a validated entry into the calculator's `StatutoryWeeklyPayCapEntry` shape.
- `CITED_RATES_SEED` — **ships EMPTY by design**. Sprint 31 deliberately does not commit any rate values to product code; the operator must add entries from verified sources. With the empty seed, the calculator continues to return `needs_verified_rate` as before.

16 vitest cases at `apps/legal-orchestrator/src/tests/statutoryRatesRegistry.test.ts` prove validation, overlap detection, and the conversion+calculator integration.

## What this calculator does NOT do

- Does **not** invent a statutory cap.
- Does **not** assess whether the supplied weekly pay is a 'week's pay' under ERA 1996 s221–s229. The caller is responsible for that determination.
- Does **not** apply any statutory continuous-service exclusions (e.g. fixed-term renewals, transfers). The caller is responsible.
- Does **not** invoke any LLM.
- Does **not** call any DB or network.
