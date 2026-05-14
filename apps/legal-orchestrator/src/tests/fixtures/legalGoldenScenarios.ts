// Sprint 25 — Golden scenarios for UK Employment law.
//
// Synthetic, deterministic fixtures only. Each scenario has a fixed expected
// outcome under defined inputs. Scenarios with `evidenceAvailable: false`
// expect `insufficient_sources`.

import type { LegalGoldenScenario } from "../../evaluation/legalGoldenHarness";

export const UK_EMPLOYMENT_GOLDEN_SCENARIOS: ReadonlyArray<LegalGoldenScenario> = [
  {
    id: "unfair_dismissal_1",
    label: "Unfair dismissal — 2-year qualifying service, fair-reasons check",
    question: "Was the dismissal unfair?",
    inputs: {
      qualifyingServiceYears: 2.5,
      reason: "redundancy",
      processFollowed: "no",
      effectiveDate: "2024-09-01",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "redundancy_1",
    label: "Statutory redundancy pay — 35yo, 10 years, £500/wk",
    question: "What is the statutory redundancy entitlement?",
    inputs: {
      ageAtDismissal: 35,
      yearsOfService: 10,
      weeklyPayGbp: 500,
      effectiveDate: "2024-09-01",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "discrimination_1",
    label: "Discrimination — protected characteristic + less favourable treatment",
    question: "Is there a prima facie discrimination claim?",
    inputs: {
      protectedCharacteristic: "race",
      lessFavourableTreatment: true,
      comparator: "same role, different race",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "holiday_pay_1",
    label: "Holiday pay — irregular hours worker",
    question: "How is holiday pay calculated for an irregular-hours worker?",
    inputs: {
      workPattern: "irregular_hours",
      reference52WeekWindow: true,
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "notice_pay_1",
    label: "Statutory minimum notice — 7 years service",
    question: "What is the statutory minimum notice period?",
    inputs: {
      yearsOfService: 7,
      noticeDirection: "employer",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "settlement_agreement_1",
    label: "Settlement agreement — without independent legal advice",
    question: "Is the settlement agreement legally binding?",
    inputs: {
      independentLegalAdvice: false,
      writtenAgreement: true,
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "whistleblowing_1",
    label: "Whistleblowing — protected disclosure test",
    question: "Was the disclosure protected under ERA 1996 s43?",
    inputs: {
      categoryOfDisclosure: "regulatory_breach",
      goodFaithBelief: true,
      disclosedTo: "employer",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "employment_status_1",
    label: "Employment status — Uber/Pimlico/Autoclenz tests",
    question: "Is the individual an employee, worker, or self-employed?",
    inputs: {
      controlByPrincipal: "high",
      mutualityOfObligation: "low",
      personalService: "required",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "acas_early_conciliation_1",
    label: "ACAS early conciliation — limitation extension",
    question: "What is the limitation extension after ACAS EC?",
    inputs: {
      ecNotifiedAt: "2024-06-01",
      ecCertificateIssuedAt: "2024-07-15",
      originalLimitationDate: "2024-08-15",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
  {
    id: "limitation_dates_1",
    label: "Limitation dates — ET claim s111 ERA 1996",
    question: "When does the ET claim need to be presented?",
    inputs: {
      eventDate: "2024-03-01",
      claimType: "unfair_dismissal",
      ecOutcome: "no_extension",
    },
    evidenceAvailable: false,
    expected: { outcome: "insufficient_sources" },
  },
];
