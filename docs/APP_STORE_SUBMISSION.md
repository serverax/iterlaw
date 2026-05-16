# App Store Submission Prep (Product Sprint 8)

**Product:** IterLaw  
**Status:** CHECKLIST — assembly-ready for submission sprint  
**Last updated:** 2026-05-16

**Note:** "Sprint 8" here refers to the **product launch sprint** (mobile store submission), not `apps/legal-orchestrator` codebase sprint numbering.

---

## 1. iOS — App Store Connect

### 1.1 Submission checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Apple Developer Program active | | Company account |
| 2 | App ID + bundle identifier | | e.g. `ai.iterlaw.app` |
| 3 | Privacy policy URL (public HTTPS) | | Required |
| 4 | Terms of use URL | | |
| 5 | App name (30 char) | | **IterLaw** |
| 6 | Subtitle (30 char) | | e.g. "UK employment rights cited" |
| 7 | Description (4,000 char) | | See §4 |
| 8 | Keywords (100 char) | | employment,dismissal,redundancy,ACAS,rights |
| 9 | Primary category | | Productivity or Reference |
| 10 | Secondary category | | Business |
| 11 | Age rating questionnaire | | Likely 12+ (legal topics) |
| 12 | Export compliance | | No encryption beyond standard HTTPS |
| 13 | Screenshots — 6.7" (1290×2796) | | 9 required if supporting all sizes — see §3 |
| 14 | Screenshots — 6.5" | | |
| 15 | Screenshots — 5.5" (1242×2208) | | **Required minimum set** |
| 16 | App preview video (optional) | | 15–30s |
| 17 | Support URL | | |
| 18 | Marketing URL | | |
| 19 | Review notes + demo account | | See §5 |
| 20 | TestFlight build uploaded | | |
| 21 | Submit for review | | |

### 1.2 Review guidelines — focus areas

| Guideline | IterLaw compliance |
|-----------|-------------------|
| **5.1.1 Privacy** | Privacy policy; data collection disclosed; document upload explained |
| **1.1.6** | No misleading legal claims; not impersonating solicitors |
| **5.2.1** | Legal / financial info — disclaimers prominent |
| **2.3.8** | Metadata accurate; screenshots match app |
| **4.2** | Minimum functionality without login if claimed |

**Mandatory in-app disclaimer**

> IterLaw provides legal information, not legal advice. It is not a law firm.

---

## 2. Android — Google Play Console

### 2.1 Submission checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Google Play Developer account | | |
| 2 | App signing (Play App Signing) | | |
| 3 | Package name | | Match iOS bundle strategy |
| 4 | Store listing — short description (80) | | |
| 5 | Full description (4,000) | | §4 |
| 6 | App icon 512×512 | | |
| 7 | Feature graphic 1024×500 | | |
| 8 | Phone screenshots — min 2, max 8 | | 1080×1920 or higher |
| 9 | 7-inch / 10-inch tablet (if supported) | | |
| 10 | Privacy policy URL | | |
| 11 | Data safety form | | See §2.2 |
| 12 | Content rating (IARC) | | |
| 13 | Target audience | | 18+ recommended |
| 14 | Closed testing track | | |
| 15 | Production release | | |

### 2.2 Data safety (declare accurately)

| Data type | Collected? | Purpose | Shared? |
|-----------|------------|---------|---------|
| Email | Yes | Account | No |
| Name | Optional | Account | No |
| User documents | Yes | Core feature | No (unless referral consent) |
| Crash logs | Yes | Stability | Analytics vendor if used |
| Payment info | If paywall | Stripe — not stored on device | Stripe |

### 2.3 Google Play — legal / financial policies

- No guaranteed legal outcomes.  
- Clear that app is not a substitute for a solicitor.  
- Subscription terms visible before purchase (if paywall in screenshots).

---

## 3. Screenshot design specs

### 3.1 Required screens (content)

| # | Screen | Message |
|---|--------|---------|
| 1 | Ask a question | Cited LAW / MEANING / ACTION answer |
| 2 | Case timeline | Deadlines + events |
| 3 | Document upload | Upload + OCR preview (post Sprint 51) |
| 4 | Paywall / subscription | Transparent pricing |
| 5 | Solicitor referral | Escalation CTA + disclaimer |

### 3.2 Dimensions

| Device | Size (px) | Platform |
|--------|-----------|----------|
| iPhone 5.5" | 1242 × 2208 | iOS (required) |
| iPhone 6.7" | 1290 × 2796 | iOS |
| Android phone | 1080 × 1920 (min) | Google Play |
| Feature graphic | 1024 × 500 | Google Play only |

### 3.3 Design rules

- Use IterLaw brand tokens (no RightsNow branding).  
- Show disclaimer bar on legal answer screens.  
- Use synthetic data only (no real client names).  
- Status bar: 9:41, full battery (iOS convention).

---

## 4. Store description draft

**Short (80 char — Android)**

```text
Understand UK employment letters with cited rights. Information, not legal advice.
```

**Full (template)**

```text
IterLaw helps UK employees understand employment problems using cited legislation
(Employment Rights Act 1996, ACAS Code of Practice) and plain-English explanations.

• Ask questions — get LAW, MEANING, and ACTION with sources
• Upload dismissal and disciplinary letters for structured analysis
• Track case deadlines and timeline events
• Request introduction to a qualified employment solicitor when you need advice

IterLaw provides legal information, not legal advice. It is not a law firm.
For advice on your specific situation, consult a solicitor.

[Subscription details if applicable]
```

---

## 5. App Review notes (paste into both stores)

```text
Demo account:
  Email: [reviewer@iterlaw.ai]
  Password: [supplied via 1Password / out-of-band]

Notes:
- App provides UK employment legal INFORMATION only, not advice.
- "Speak to a solicitor" triggers a referral flow; IterLaw is not a law firm.
- Document upload uses user-selected files; test PDF available in demo case.
- Paywall can be bypassed with reviewer flag ITERLAW_REVIEWER=1 on staging.

Contact: [engineering email]
```

---

## 6. Asset tracker

| Asset | iOS | Android | Owner | Due |
|-------|-----|---------|-------|-----|
| Icon | | | Design | |
| Screenshots set 1–5 | | | Design | |
| Description copy | | | Product + Legal | |
| Privacy policy | | | Legal | |
| Demo build | | | Engineering | |

---

## 7. Submission timeline (relative to launch)

| Day | Action |
|-----|--------|
| T-14 | Screenshots + copy frozen |
| T-10 | TestFlight + Play internal testing |
| T-7 | Submit iOS + Android for review |
| T-0 | Release if approved (or phased rollout 5%) |
