# Solicitor Referral Partners — Framework (Gate 4)

**Product:** IterLaw  
**Status:** DRAFT — recruitment framework  
**Gate:** **5 signed partners** before public launch (PRD Section 16, Gate 4)  
**Last updated:** 2026-05-16

**Related:** `docs/iterlaw/project/01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md` (escalation_agent), `docs/DISTRIBUTION_PLAN.md`

---

## 1. Programme summary

| Item | Value |
|------|--------|
| Referral fee (qualified lead) | **£50–£200** per partner tier (see §3) |
| Qualified lead definition | User completed case summary + consented to referral + meets firm intake criteria |
| Response SLA (partner) | **&lt; 4 hours** initial acknowledgement (business hours) |
| IterLaw role | Introduction only — not a law firm, no fee-sharing advice without SRA review |

---

## 2. Partner tiers

| Tier | Fee per qualified lead | Volume cap / month | Firm profile |
|------|------------------------|-------------------|--------------|
| **Bronze** | £50 | 20 | High-street; employment desk |
| **Silver** | £100 | 50 | Boutique employment |
| **Gold** | £150 | 100 | Regional specialist |
| **Platinum** | £200 | Unlimited* | Union panel / national firm |

\*Subject to quality review and conversion reporting.

**Qualified lead criteria (all tiers)**

1. User clicked "Speak to a solicitor" and accepted referral terms.  
2. Case summary PDF generated (§5).  
3. Jurisdiction = England & Wales; module = UK Employment.  
4. Not flagged as emergency / harm (route to appropriate services).  
5. Partner confirms intake within 5 business days or lead returns to pool.

---

## 3. Partnership agreement template (outline)

> **Not legal advice.** Have partnership terms reviewed by your solicitor and SRA-regulated counsel before execution.

### 3.1 Parties

- **IterLaw Ltd** ("Platform")  
- **[Firm Name]** ("Partner"), SRA number: _______

### 3.2 Scope

- Platform refers users seeking employment law advice to Partner.  
- Partner provides legal services under their own terms; Platform does not supervise legal work.

### 3.3 Referral fee

- Fee: £[50–200] per **Qualified Lead** (§2).  
- Payable within [30] days of invoice; monthly statement.  
- No fee if user does not instruct within [14] days or lead was duplicate/spam.

### 3.4 SLA

- Partner acknowledges referral within **4 hours** (Mon–Fri 09:00–18:00 UK).  
- Initial call or email to user within **1 business day**.

### 3.5 Data protection

- Platform shares: name, contact, case summary PDF, consent timestamp.  
- Partner acts as independent controller for client matter data.  
- DPA schedule attached (Art 28 if Partner processes on Platform instructions — usually N/A).

### 3.6 Marketing

- Partner may not imply SRA endorsement of IterLaw.  
- Co-branded materials require written approval.

### 3.7 Term

- Initial term: 12 months; 30-day termination notice.  
- Survival: confidentiality, data protection, accrued fees.

### 3.8 Signatures

| IterLaw | Partner |
|---------|---------|
| Name: | Name: |
| Title: | Title: |
| Date: | Date: |

---

## 4. Partner onboarding checklist

| # | Task | Owner | Done |
|---|------|-------|------|
| 1 | SRA firm verify + conflicts check | Legal | |
| 2 | Signed referral agreement | Partnerships | |
| 3 | Intake email + phone for referrals | Partner | |
| 4 | Fee tier assigned (Bronze–Platinum) | Partnerships | |
| 5 | CRM / inbox tested with test PDF | Engineering | |
| 6 | Partner profile in app (name, logo, areas) | Product | |
| 7 | SLA monitoring alert configured | Engineering | |
| 8 | Pilot: 5 test referrals | QA | |
| 9 | Go-live in partner roster | Product | |

---

## 5. Case summary PDF template (auto-generated)

The app generates this on escalation (target: Sprint 7+ / escalation_agent).

### 5.1 Sections

| Section | Content |
|---------|---------|
| **Header** | IterLaw referral pack — **Information not advice** — generated [timestamp] |
| **User** | First name + initial; email; phone (if consented) |
| **Case** | Case ID; workspace; created date |
| **Situation** | `situation_type`; free-text user summary (max 2,000 chars) |
| **Timeline** | Key dates from `legal_case_timeline` |
| **Documents** | List of uploaded docs (filename, type, upload date) — no full text unless user opts in |
| **AI summary** | LAW / MEANING / ACTION from last approved answer (with citations) |
| **Deadlines** | Extracted appeal / ACAS / ET limitation flags |
| **Referral** | Consent ID; partner assigned; fee tier |
| **Footer** | Disclaimer + IterLaw contact |

### 5.2 Markdown skeleton (engineering)

```markdown
# IterLaw Referral Pack — {{case_id}}

**Generated:** {{iso_timestamp}}  
**Disclaimer:** This document is legal information prepared by IterLaw, not legal advice.

## Client
- Name: {{user_display_name}}
- Contact: {{email}} / {{phone}}

## Situation
- Type: {{situation_type}}
- Summary: {{user_narrative}}

## Key dates
{{#each timeline_events}}
- {{date}}: {{label}}
{{/each}}

## Documents on file
{{#each documents}}
- {{file_name}} ({{mime_type}}, uploaded {{uploaded_at}})
{{/each}}

## Last cited guidance (from IterLaw)
**LAW:** {{answer_law_section}}  
**MEANING:** {{answer_meaning}}  
**ACTION:** {{answer_action}}  
**Sources:** {{citations}}

## Flags
- Urgency: {{urgency}}
- Manual review required: {{needs_review}}

## Referral consent
- Consent recorded: {{consent_at}}
- Partner: {{partner_name}}
```

---

## 6. Target firms (initial outreach list)

| Firm (example category) | Type | Region | Status |
|-------------------------|------|--------|--------|
| _Employment Law Boutique A_ | Boutique | London | Prospect |
| _Regional EL firm B_ | Specialist | Manchester | Prospect |
| _High street C_ | General + EL desk | Birmingham | Prospect |
| _Union panel firm D_ | Panel | National | Prospect |
| _Legal expenses insurer panel E_ | Panel | National | Prospect |

**Populate with real firm names after conflicts check.**

### 6.1 Selection criteria

- SRA-regulated with identifiable employment team.  
- Willing to accept digital referrals + 4h SLA.  
- Clear published fees or free initial consultation.  
- No conflict with IterLaw investors / operators.

---

## 7. Pipeline tracker (5-partner gate)

| # | Firm | Tier | Agreement signed | Onboarding complete | Live |
|---|------|------|------------------|---------------------|------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

**Gate status:** 0 / 5 signed — **NOT MET**

---

## 8. Metrics

| Metric | Target (month 1) |
|--------|------------------|
| Referral requests | 50 |
| Partner ack &lt; 4h | 95% |
| User instructs partner | 25% conversion |
| Partner complaints | 0 material |
