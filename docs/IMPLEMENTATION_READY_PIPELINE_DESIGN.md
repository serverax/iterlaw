# RightsNow / IterLaw — Implementation-ready pipeline design (corrected)

**Status:** Design only. **Do not implement** until this document is accepted.  
**Supersedes** prior draft wording on: zero-knowledge, FWA submission, confidence→cache, hostname checks, hardcoded legal limits, unfair dismissal / Vento / SSP shortcuts, and audit content.

**Related:** `docs/PHASE_1_AXIOM_PIPELINE.md` — Phase **1A–1D** slices, **AEE / ART / SEA** definitions, SEA neutral wording, and naming guardrails aligned with this pipeline.

---

## 1. Legal constants — no hardcoded runtime values

### 1.1 Forbidden

- **Do not** add or use `src/constants/legalConstants.ts` (or any module of hardcoded limits for production legal calculations).
- **Do not** use “fallback” literals in engines when a DB row is missing.

### 1.2 Required behaviour

All monetary caps, rates, bands, **qualifying service months**, **paternity / parental leave qualifying rules**, and similar **must** be read from the **`legal_constants`** table (or an approved signed bundle whose hash is pinned and treated as equivalent to DB — still row-like, not scattered literals).

### 1.3 Missing constant

If a required key is absent for `(jurisdiction, effective_date)`:

- **Do not** calculate.
- Return **escalation / error** with this exact user-facing message (or API equivalent):

> **Legal constant unavailable. Cannot calculate safely.**

(Log internally: `constant_key`, `jurisdiction`, `as_of_date`.)

---

## 2. Source verification — strict allow-list

### 2.1 Forbidden

```text
hostname.includes(domain)   // NEVER — allows legislation.gov.uk.evil.com
```

### 2.2 Required

For each allowed **registrable domain** `d` (e.g. `legislation.gov.uk`, `gov.uk`, `acas.org.uk`, `judiciary.uk`):

```text
hostname === d  OR  hostname.endsWith('.' + d)
```

**Examples**

- `legislation.gov.uk` → allowed.
- `www.gov.uk` → `hostname.endsWith('.gov.uk')` → allowed if `gov.uk` is in the list (policy: list both `www.gov.uk` and `gov.uk` explicitly if you do not want all `*.gov.uk`).

**Policy decision (implement explicitly):** Either enumerate exact hostnames, or use `endsWith('.gov.uk')` only if product accepts **all** subdomains of `gov.uk`. Document the chosen list in config, not ad hoc string checks.

### 2.3 Additional checks

- TLS required.
- Optional: pin expected path prefixes per source type.
- Hash or etag canonical body where feasible.

---

## 3. Answer pipeline — no AI-as-verified-legal-answer

| Situation | Behaviour |
|-----------|------------|
| **Controlled source match** + **cached row** already passes **review gate** (§4) | **May serve** to user as the verified answer path. |
| **Controlled source match** but **no** approved cache | **Persist inactive** (`is_active = false`, `legal_reviewer_approved = false`), **enqueue `review_queue`**, return **non-final** response (summary / “under review” / partial citation-only guidance per policy — **not** a full “legal answer” claim). |
| **No** trusted source match | **Safe escalation / referral** response only (ACAS, solicitor, ET info links as appropriate). **No** fabricated statute. |
| **AI fallback** (model generation) | **Draft only** (internal or explicitly labelled draft for user review). **Never** treated as verified legal answer; **never** auto-activated in cache. |

---

## 4. Review gate — no confidence shortcut

### 4.1 Forbidden

Any rule of the form:

```text
confidence >= 0.85 → cache answer active
```

Confidence scores may inform **routing** or **draft quality** but **must not** activate reusable cache.

### 4.2 Required to **serve** a cached / reusable answer

All must hold:

1. `legal_reviewer_approved = true`
2. `is_active = true`
3. `decision IN ('approved', 'approved_with_disclaimer')`
4. **Source verified** (bundle satisfies `source-verification` rules for the claims in the answer)
5. `expires_at IS NULL OR expires_at > now()`
6. `jurisdiction` matches the request context

**Note:** Existing code (e.g. validation thresholds using `0.85`) must be **re-audited** so it cannot bypass this gate for **publish** or **cache serve**.

---

## 5. Unfair dismissal — qualifying service (date-driven)

### 5.1 Forbidden

- Hardcoding **“6 months”** (or any period) for “June 2026” or any date unless a **`legal_constants`** row with **primary law citation** confirms that period is in force for **that** dismissal / claim date.

### 5.2 Required

- Constant key example: **`ordinary_unfair_dismissal_qualifying_service_months`** (or equivalent explicit key per jurisdiction), with `effective_from` / `effective_to`, `source_url`, `source_citation`, `reviewed_by`, `reviewed_at`.
- **ART** selects the row valid for the **relevant statutory date** (e.g. dismissal date), not “today” unless policy says so.
- If the constant is **missing** → **escalation** (same family as §1.3; do not guess months).

---

## 6. Paternity / unpaid parental leave — no hardcoded commencement

### 6.1 Forbidden

- Hardcoding **6 April 2026** (or any date) for day-one rights in application code.

### 6.2 Required

Store and load from **`legal_constants`** (examples — adjust keys to your schema):

- `paternity_leave_qualifying_service` (structure + effective dates per jurisdiction)
- `unpaid_parental_leave_qualifying_service`
- Each with **`effective_from`**, optional **`effective_to`**, **`source_url`**, **`source_citation`**, verification fields.

**Extraction** may flag contract text inconsistent with **loaded** rows for the user’s jurisdiction and `as_of_date`; it must not embed the date in code.

---

## 7. ACTION / guidance validation — “should” allowed

### 7.1 Allowed (examples)

- “You **should** keep evidence.”
- “You **should** contact ACAS.”

### 7.2 Banned hedging (examples — expand in linter rules)

- “maybe”, “possibly”
- “you might want to”
- “you could consider”

**Implement:** allow-list / deny-list policy separate from banning the word “should” globally.

---

## 8. Compensation engine — basic award (statutory redundancy / basic award style)

### 8.1 Forbidden

- Applying **one** age multiplier across **all** years of service.

### 8.2 Required algorithm (England & Wales statutory redundancy pattern)

For each **complete** year of service (chronological allocation per statute rules — implement from ERA and guidance rows, not memory):

- Age **under 22:** **0.5** × capped week’s pay for that year  
- Age **22–40:** **1.0** × capped week’s pay  
- Age **41+:** **1.5** × capped week’s pay  

Constraints:

- **Maximum 20 years** count toward the sum (per statute).
- **Week’s pay** for each year uses the **same** capped weekly amount from **`legal_constants`** for the relevant calculation date (see **`WEEKLY_PAY_CAP`** row), unless statute requires otherwise — **load from DB**.

**Basic award** for unfair dismissal (where applicable) uses its **own** statutory formula and rows — **do not** reuse the redundancy multipliers interchangeably; mirror the correct sections from **`legal_constants`** / primary sources.

---

## 9. Injury to feelings (Vento) — separate from ordinary unfair dismissal

- **Vento** applies to **discrimination** and **certain statutory detriment** claims per case law and Presidential Guidance — **not** to ordinary unfair dismissal compensation.
- **Implement:** separate module path and **separate** constant keys (`VENTO_*`) loaded only when the **claim type** and **presentation date** justify injury-to-feelings valuation.
- **Do not** add Vento amounts into an ordinary unfair dismissal total.

---

## 10. SSP — qualifying days, not `calendar_days / 7`

### 10.1 Required

- Use **absence period**, **contractual / statutory normal working pattern** (or user-supplied pattern), and rules from **`legal_constants`** + GOV.UK / SI rows for the pay date.
- Compute **SSP** from **qualifying days** in the period (and rate: lower of flat weekly rate row and 80% AWE where rules say so).

### 10.2 Unknown pattern

If qualifying days **cannot** be determined:

- Return **estimate** with explicit **caveat** + request for schedule / work pattern, **or** escalation — **never** silent `days/7`.

---

## 11. Audit logging — minimise raw question text

### 11.1 Default storage (design)

| Field | Purpose |
|--------|---------|
| `anonymised_question` | Redacted / truncated text safe for logs |
| `question_hash` | Stable hash of normalised question for dedupe |
| `user_id` | **Nullable** where anonymous or not yet linked |
| `retention_until` | Policy-driven deletion horizon |
| `deletion_status` | e.g. `active`, `scheduled_delete`, `deleted` |

**Do not** store **raw** `user_question` by default in audit tables. If raw storage is ever required, separate **encrypted** store + **legal basis** + **TTL** + access control — out of default path.

---

## 12. Enforcement drafting — naming and scope

### 12.1 Forbidden name

- **“Financial Warrant of Authority”** and similar misleading FWA-as-authority framing.

### 12.2 Module name

- **`enforcementDraftingService.ts`** (or equivalent path under `lib/` / backend services).

### 12.3 Outputs (drafts only, user review)

- Draft **employer** letter (neutral, source-cited).
- Draft **evidence checklist**.
- Draft **complaint pack for user review**.

### 12.4 Forbidden claim

- **No** “direct FWA submission” or **official FWA API** language unless a real integration is built and verified.

---

## 13. Vento — source URL and seeding

- **Do not** seed Vento band constants until the **correct** **April 2026 Presidential Guidance addendum** URL (and citation text) is **pinned** in `legal_constants` by legal ops.
- Remove or **ignore** any spec line pointing at **obsolete** 2020-only guidance as the production source.

---

## 14. `public.users` — primary key and auth

### 14.1 Forbidden (standalone app profile migrations)

```sql
id UUID PRIMARY KEY DEFAULT auth.uid()
```

That pattern ties a **public** table default to **`auth.uid()`**, which is **not** appropriate as a generic standalone definition and is easy to misuse offline from Auth context.

### 14.2 Required direction

- Either integrate **`auth.users`** / Supabase Auth **explicitly** with documented sync (trigger or app flow), **or** keep auth **out** of this migration and use a neutral PK (`uuid` generated) plus optional **`auth_user_id`** FK to `auth.users(id)` when Auth exists.
- Document the chosen model in DB migrations and RLS plan **before** production.

---

## 15. HLD — data flow (encryption and processing)

### 15.1 Forbidden wording

- Do **not** state that the **backend extracts facts from ciphertext** if the server **cannot decrypt** that ciphertext.

### 15.2 Correct description

1. **Client-side encryption** for **storage-at-rest** payloads where the product supports it.  
2. **Controlled server-side processing** only where the **user permits temporary decryption/processing** for stated features (e.g. extraction run), with documented retention.  
3. **No “true zero-knowledge”** claim unless architected, implemented, and independently verified.

### 15.3 Flow (concise)

```
Client encrypts for storage → uploads ciphertext + metadata
→ User consents to processing job → server decrypts in ephemeral / controlled context (if applicable)
→ AEE / ART / retrieval run on plaintext in that bounded context
→ Outputs + audit (no raw question by default)
→ Re-encrypt for storage where required
→ Review queue for anything not source-verified + legally approved for serve
```

---

## Implementation checklist (for when coding is allowed)

- [ ] Ensure **no** `legalConstants.ts` (or equivalent) is introduced.  
- [ ] Implement allow-list with **strict** hostname rules (§2).  
- [ ] Wire **answer pipeline** and **review gate** exactly as §§3–4.  
- [ ] Load **qualifying service** and **parental** rules from **`legal_constants`** only (§§5–6).  
- [ ] Update **action** validation per §7.  
- [ ] Rebuild **compensation** basic/redundancy logic year-by-year (§8); separate **Vento** (§9).  
- [ ] **SSP** by qualifying days (§10).  
- [ ] **Audit** schema per §11.  
- [ ] Rename / scope **enforcement drafting** per §12.  
- [ ] **Vento** seed only after URL pinned (§13).  
- [ ] Fix **`users`** migration pattern when Auth is designed (§14).  
- [ ] Update public **HLD** text to §15.

---

**Related documents:** `docs/ITERLAW_RIGHTSNOW_HLD_LLD.md`, `docs/AXIOM_ALGORITHM_SPEC_ENGLAND_WALES_2026.md` — align their next revision with this file; this document **wins** on conflicts until superseded.
