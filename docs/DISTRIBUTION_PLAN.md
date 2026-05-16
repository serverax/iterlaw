# Distribution Plan (Pre-Launch) — Gate 5

**Product:** IterLaw (UK Employment MVP)  
**Status:** DRAFT — ready for stakeholder review  
**Gate:** Mandatory before public launch (PRD Section 16, Gate 5)  
**Target:** Complete before **product Sprint 9** launch activities (not codebase sprint numbering)  
**Last updated:** 2026-05-16

---

## 1. Objectives

- Acquire first **1,000** qualified UK employment-law users without paid ads at launch.
- Drive **solicitor referral** conversions (see `docs/SOLICITOR_REFERRAL_PARTNERS.md`).
- Maintain **information not advice** positioning in all copy.
- Avoid claims that imply regulated legal services or guaranteed outcomes.

---

## 2. Reddit strategy

### 2.1 Target subreddits

| Subreddit | Audience fit | Post type | Risk |
|-----------|--------------|-----------|------|
| r/BritishProblems | Broad UK; employment pain points | Story + soft CTA | Medium — keep non-promotional |
| r/AskUK | General UK advice seekers | Helpful comment + link in profile | Low if value-first |
| r/LegalAdviceUK | Legal questions (not solicitors) | Educational only; strict rules | **High** — read rules; no solicitation |
| r/UKJobs | Employment disputes, redundancy | AMA-style or resource post | Medium |
| r/WorkUK | Workplace issues | Tool announcement after karma | Medium |
| r/unitedkingdom | Broad reach | Avoid unless mod-approved | High noise |

**Employment-specific (research mod rules before posting)**

| Subreddit | Notes |
|-----------|--------|
| r/EmploymentLawUK | If exists / active — highest intent |
| r/labouruk | Union-adjacent audience; political tone risk |

### 2.2 Post templates

**Template A — Problem story (r/BritishProblems style)**

```text
Title: Got a dismissal letter and had no idea what the deadlines actually mean

Body: [Personal tone — anonymised]. Spent a weekend trying to work out appeal windows and ACAS.
Built/using IterLaw to map ERA sections to plain English with citations (not legal advice).
Happy to share what I learned about [appeal deadline / ACAS EC] if useful.
```

**Template B — Resource (r/AskUK)**

```text
Title: Free checklist: what to check in a UK dismissal letter (not legal advice)

Body: 1) Effective date vs issue date 2) Reason given 3) Appeal route + deadline
4) Statutory rights mentioned 5) ACAS EC clock
Tool we use: IterLaw — cites legislation chunks; flags gaps. Link: [staging URL when live]
Disclaimer: information only; speak to a solicitor for advice.
```

**Template C — Comment reply (high-intent threads)**

```text
Not a solicitor — but for [unfair dismissal / redundancy], check: qualifying service,
reason band (conduct/capability/redundancy), and whether appeal deadline is in the letter.
IterLaw breaks down letters with citations if you want a structured pass: [link]
```

### 2.3 Timing

| Window | Action |
|--------|--------|
| T-14 days | Create accounts; build karma with genuine comments (no links) |
| T-7 days | Mod-mail r/LegalAdviceUK if doing any resource post |
| Launch day (T-0) | Template B on r/AskUK; Template A on r/BritishProblems (stagger 4h) |
| T+1 to T+3 | Reply to employment threads with Template C (max 5/day/account) |
| T+7 | Retrospective post only if metrics hit; avoid spam |

### 2.4 Reddit rules compliance

- No brigading; no multiple accounts upvoting.
- Disclose affiliation: "I work on IterLaw" when linking product.
- Never claim to be a solicitor or give individual case advice in comments.

---

## 3. Union outreach

### 3.1 Target list (initial)

| Union | Sector | Contact path | Priority |
|-------|--------|--------------|----------|
| **UNISON** | Public sector, NHS, local gov | Membership services / digital partnerships | P1 |
| **Unite** | Manufacturing, transport, general | Regional offices + national digital | P1 |
| **GMB** | General, retail, local gov | Campaigns team | P2 |
| **USDAW** | Retail, distribution | Member support | P2 |
| **PCS** | Civil service | If public-sector angle | P3 |
| **NEU** | Education | Term-time disputes | P3 |

### 3.2 Value proposition (per union — customise opening)

| Union type | Value prop |
|------------|------------|
| Large general (Unison, Unite) | Member self-serve triage before helpline; reduces simple queries; **cited** rights summaries |
| Retail (USDAW) | Quick letter parsing (disciplinary, capability); deadline alerts |
| All | White-label or co-branded landing; **no** replacement for union rep; referral to union legal + panel solicitors |

### 3.3 Intro email template

```text
Subject: Member self-serve triage tool for employment rights (information, not advice)

Dear [Name / Partnerships team],

IterLaw helps [union] members understand employment letters and deadlines using
cited UK legislation (ERA 1996, ACAS Code) — information only, not legal advice.

We propose:
- Co-branded member landing page
- API or embed for your existing member portal (optional)
- Escalation path to [union legal services / panel firms] for complex cases

Pilot: 90 days, free to members, analytics on topic volume (aggregated, no PII).

Could we book 20 minutes to explore fit?

[Name]
[Role]
IterLaw
```

### 3.4 Union pipeline tracker

| Union | Contact | Meeting | Pilot agreed | Launch co-marketing |
|-------|---------|---------|--------------|---------------------|
| UNISON | | | | |
| Unite | | | | |
| GMB | | | | |
| USDAW | | | | |

---

## 4. PR pitch

### 4.1 Press release draft (embargo optional)

```text
FOR IMMEDIATE RELEASE / EMBARGO UNTIL [DATE TIME GMT]

IterLaw launches cited employment-rights guidance for UK workers

[LONDON, DATE] — IterLaw today launched a platform that helps UK employees
understand dismissal and disciplinary letters using legislation-backed citations
(Employment Rights Act 1996, ACAS Code of Practice). The service provides
information, not legal advice, and offers escalation to qualified solicitors.

[Founder quote — 2 sentences on problem + approach]

[Stat — e.g. X% of users miss appeal deadlines when letters are unclear]

Availability: Web + iOS/Android apps. UK employment module at launch.

Media contact: [email]
https://[domain]
```

### 4.2 Journalist / blogger targets

| Beat | Outlets / individuals (research current bylines) | Angle |
|------|--------------------------------------------------|-------|
| Employment law | **People Management**, **Personnel Today**, **LAW360** (UK) | Tech + access to justice |
| Legaltech | **Artificial Lawyer**, **Legal Geek** blog | Citation-locked AI |
| Consumer | **MoneySavingExpert** forum team, **Which?** (long shot) | Worker rights |
| Tech | **TechCrunch** (EU), **Sifted** | Responsible legal AI |
| Trade press | **HR Magazine**, **CIPD** | HR compliance awareness |

### 4.3 Embargo timeline

| Date | Action |
|------|--------|
| T-21 | Finalise press kit (screenshots, founder bio, fact sheet) |
| T-14 | Send embargoed release to Tier 1 (3–5 journalists) |
| T-7 | Follow-up calls; offer demo accounts |
| T-1 | Reminder + link to staging/demo |
| T-0 09:00 GMT | Publish release; social amplification |
| T+1 | Monitor pickup; respond to corrections within 4h |

---

## 5. Launch day checklist

| Time (GMT) | Channel | Owner | Asset | Done |
|------------|---------|-------|-------|------|
| 08:00 | Press release wire / email | Founder | PR draft §4.1 | |
| 09:00 | Website / blog | Product | Launch post + disclaimer | |
| 09:30 | LinkedIn (company + founder) | Founder | 3-slide carousel | |
| 10:00 | Reddit r/AskUK | Growth | Template B | |
| 14:00 | Reddit r/BritishProblems | Growth | Template A | |
| 15:00 | Email waitlist | Product | Launch email | |
| 16:00 | Union partners (if live) | Partnerships | Co-branded email | |
| 17:00 | App Store (if approved) | Product | See `docs/APP_STORE_SUBMISSION.md` | |
| EOD | Metrics review | Product | Signups, referrals, errors | |

### 5.1 Roles (assign names)

| Role | Responsibility |
|------|----------------|
| Launch lead | Go/no-go, timeline |
| Comms | PR, social, union emails |
| Engineering | Status page, incident bridge |
| Legal SME | Approve public copy |
| Support | In-app feedback + referral queue |

---

## 6. Success metrics (first 30 days)

| Metric | Target |
|--------|--------|
| Registered users | 1,000 |
| Document uploads | 200 |
| Solicitor referral requests | 50 |
| Press mentions | 3 tier-2+ |
| Reddit referral traffic | 15% of signups |
| Union pilot signups | 1 union live |

---

## 7. Compliance copy (mandatory on all channels)

> IterLaw provides legal information, not legal advice. It is not a law firm.
> For advice on your situation, consult a qualified solicitor.

---

## 8. Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product | | | |
| Legal SME | | | |
| Founder | | | |
