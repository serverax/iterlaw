# Sprint 37 — Cited statutory weekly-pay-cap seed entries

## Verdict: PARTIAL

The **ingestion path** is delivered: `ingestCitedStatutoryRateSeed(entries)` validates every candidate, refuses missing metadata, refuses duplicates, refuses overlapping windows, and converts the survivors into a `StatutoryRatesRegistry` for the redundancy calculator. 16 vitest cases. **No authoritative statutory cap values are committed in product code.** The function works on an empty seed (returns an empty registry plus `seed_ingest:empty_seed_no_production_claim`), and the redundancy calculator continues to return `needs_verified_rate` until the operator supplies real cited entries. Per the global rule "Do not invent statutory rates" and the per-sprint rule "PARTIAL if no authoritative values are supplied", this sprint is **PARTIAL** — not PASS.

## Why PARTIAL (not PASS)

The task explicitly said: "If no authoritative values are supplied, Sprint 37 must be PARTIAL, not PASS." This session has no operator-supplied cited rate file with a real source URL and a verified-on date. The repository has no committed authoritative weekly-pay-cap source. Inventing values would violate "No invented statutory rates."

What is delivered:

- Full ingestion + validation + duplicate-detection + overlap-detection + transform pipeline.
- `selectCapForDate(registry, isoDate)` helper for inspection / dry-run.
- 16 vitest cases that prove the validation behaviour.
- An empty seed is accepted but produces a registry the calculator correctly refuses with `needs_verified_rate`.

What is **not** delivered (and intentionally so):

- Any committed rate value in product code.
- Any `legislation.gov.uk` or `gov.uk` URL pointing to an authoritative cap.

## Files

- **New code:** `apps/legal-orchestrator/src/legalRules/statutoryRateSeed.ts` (≈115 lines, pure).
- **New tests:** `apps/legal-orchestrator/src/tests/statutoryRateSeedIngestion.test.ts` (16 vitest cases).

## Behaviour contract

| Case | Outcome |
|---|---|
| Empty seed | `{ ok: true, registry: { weeklyPayCaps: [] }, reasonCodes: [..., "seed_ingest:empty_seed_no_production_claim"] }`. Calculator with this registry returns `needs_verified_rate`. |
| Single valid cited entry | Accepted; registry has 1 cap; calculator runs successfully against the entry's window. |
| Missing source title / url | Refused with `missing_source_title` / `missing_source_url`. |
| Non-https url | Refused with `source_url_not_https`. |
| Untrusted host | Refused with `source_url_not_trusted_host`. |
| Bad `verified_at` / non-ISO `effective_from` | Refused with `verified_at_not_iso` / `effective_from_not_iso`. |
| Out-of-range trust score | Refused with `trust_score_invalid`. |
| Duplicate `(jurisdiction, rate_type, effective_from)` | Refused with `duplicate_key`. |
| Overlapping windows | Refused with `overlap_pairs`. |
| Different `effective_from`, non-overlapping windows | Both accepted. |
| `selectCapForDate` lookup | Picks covering entry; `undefined` when no window matches or date is non-ISO. |

## Acceptance evidence

```text
$ cd apps/legal-orchestrator && npx vitest run src/tests/statutoryRateSeedIngestion.test.ts
 ✓ src/tests/statutoryRateSeedIngestion.test.ts (16 tests) 14ms
TEST_EXIT=0
```

## Operator action to flip Sprint 37 to PASS

1. Locate the in-force statutory weekly-pay-cap Order on `legislation.gov.uk` AND the corresponding `gov.uk` rates page.
2. Author a `CitedStatutoryRateEntry` (or list of historical entries — each year's Order) with:
   - `jurisdiction: "UK_ENGLAND_WALES"` (or appropriate)
   - `rate_type: "statutory_weekly_pay_cap"`
   - `amount: <whole pounds from the Order>`
   - `currency: "GBP"`
   - `effective_from`, `effective_to` (ISO dates from the Order)
   - `source_title` (the Order's full title)
   - `source_url` (https:// URL on a trusted host)
   - `verified_at` (today's ISO date)
   - `trust_score: 0.95`
3. Pass the list to `ingestCitedStatutoryRateSeed(entries)`. The function returns `{ ok: true, registry, ... }`.
4. Wire `registry` into the redundancy calculator at call sites.
5. Run the orchestrator suite. Commit alongside a redacted operator evidence note.

## Production gate impact

None. The calculator registry's `statutory_redundancy_pay` entry remains `implemented` (Sprint 21); the production-readiness gate JSON is unchanged.

## What this sprint does NOT do

- Does **not** commit any statutory cap value.
- Does **not** scrape `legislation.gov.uk` or `gov.uk`.
- Does **not** call any LLM.
- Does **not** modify the empty `CITED_RATES_SEED` Sprint 31 exposed.

## Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- **No invented statutory rates.** No rate values in product code.
- No deploy. No `kubectl` mutating command. No production DB touched.
- No `git push --force`. No git history rewrite. No `npm audit fix --force`.
- No external LLM call. No secrets read, printed, or committed.
