# Sprint 31 — Populate statutory rates registry with cited cap entries

## Verdict: PARTIAL

The **validation + conversion structure** for cited statutory rate entries is added with 16 vitest cases. The **production rate seed (`CITED_RATES_SEED`) ships EMPTY by design** — IterLaw refuses to commit rate values that are not externally verified in this environment, and no committed evidence file with authoritative statutory weekly-pay cap entries existed before this sprint. Per the task rules ("If no official source evidence is committed, create the structure and mark PARTIAL"), this sprint is **PARTIAL** — not PASS.

## Why PARTIAL and not PASS

The task acceptance for PASS was: "at least one cited official rate entry is added and tests prove it." The user prompt also said: "Do not invent rates. ... If a rate cannot be sourced from existing project evidence, mark it missing." In this environment:

- No prior committed file holds an authoritative statutory weekly-pay cap with a `source_url` to `legislation.gov.uk` or `gov.uk`.
- This session cannot call out to an external service to verify a current rate (forbidden by the global rules).
- Inventing or guessing a numeric cap would violate the "no fake PASS" rule.

The honest classification is therefore PARTIAL: structure delivered + tested, seed empty, blocker exact ("no committed authoritative source"), operator action documented.

## Files

- **New code:** `apps/legal-orchestrator/src/legalRules/statutoryRateSources.ts` (validation + conversion + empty seed).
- **New tests:** `apps/legal-orchestrator/src/tests/statutoryRatesRegistry.test.ts` (16 vitest cases).
- `docs/iterlaw/project/11-calculators/STATUTORY_REDUNDANCY_PAY_CALCULATOR.md` — Sprint 31 section added.
- `docs/iterlaw/architecture/ITERLAW_STATUTORY_CALCULATOR_REGISTRY.md` — Sprint 31 paragraph added.

## Validation contract

`validateCitedRateEntry(entry)` rejects an entry that has any of:

- missing or blank `jurisdiction`
- missing `rate_type`
- non-positive / non-finite `amount`
- `currency` ≠ `"GBP"`
- non-ISO `effective_from` or `effective_to`
- `effective_to < effective_from` (inverted window)
- missing or blank `source_title`
- missing `source_url`
- `source_url` protocol ≠ `https:`
- `source_url` hostname not in `{www.legislation.gov.uk, www.gov.uk, www.acas.org.uk, www.judiciary.uk}`
- missing `verified_at`, or non-ISO `verified_at`
- `trust_score` not finite, ≤ 0, or > 1

`validateNoOverlappingRanges(entries)` refuses any pair of entries sharing `(jurisdiction, rate_type)` whose windows overlap. Open-ended `effective_to: null` is treated as +∞.

`citedToStatutoryWeeklyPayCap(entry)` returns either a valid `StatutoryWeeklyPayCapEntry` for the redundancy calculator OR a structured failure with the same failure codes.

## Operator action to flip to PASS

1. Locate the in-force statutory weekly-pay cap order on `legislation.gov.uk` (e.g. The Employment Rights (Increase of Limits) Order for the relevant year) AND the corresponding `gov.uk` rates page.
2. Author a fully-populated `CitedStatutoryRateEntry` with:
   - `jurisdiction: "UK_ENGLAND_WALES"`
   - `rate_type: "statutory_weekly_pay_cap"`
   - `amount: <whole pounds from the Order>`
   - `currency: "GBP"`
   - `effective_from`, `effective_to` (ISO dates from the Order)
   - `source_title` (Order's full title)
   - `source_url` (https:// URL on a trusted host)
   - `verified_at` (today's ISO date)
   - `trust_score: 0.95`
3. Run it through `validateCitedRateEntry`. The validation must return `{ ok: true, failures: [] }`.
4. Convert via `citedToStatutoryWeeklyPayCap` and add to the operator's seed file. Commit the entry alongside a redacted operator evidence note.

## Test evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/statutoryRatesRegistry.test.ts
 ✓ src/tests/statutoryRatesRegistry.test.ts (16 tests) 18ms
TEST_EXIT=0
```

Tests cover:

- Production seed is EMPTY (asserted explicitly).
- Validation accepts a fully-populated trusted-host entry.
- Validation rejects missing source_title, non-https URLs, untrusted hosts, non-positive amounts, trust_score out of range, inverted windows, non-ISO verified_at.
- Range-overlap detection: non-overlapping → ok; overlapping → failure; null `effective_to` → open-ended; different jurisdictions → independent.
- Calculator integration: a validated entry produces a successful `calculateStatutoryRedundancyPay` call; an invalid entry refuses to convert; empty registry still returns `needs_verified_rate`.

## Production gate impact

None. The `statutoryRedundancyPay` calculator status in the registry is unchanged from Sprint 21 (`implemented`); only the production-seed shape changes (still empty).

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- **No rate values invented.** Production seed empty by design.
- No external scraping. No external LLM. No DB.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No secrets read, printed, or committed.
