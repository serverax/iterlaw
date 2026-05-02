/**
 * Fire-and-rehire / dismissal and re-engagement risk framing (logic only, not legal advice).
 */

export type FinancialNecessityClaimed = true | false | 'unknown';

export type FireAndRehireEvidenceKey =
  | 'insolvency_risk'
  | 'going_concern_evidence'
  | 'accounts'
  | 'consultation_records'
  | 'alternatives_considered'
  | 'business_continuity_evidence';

export const FIRE_AND_REHIRE_EVIDENCE_CHECKLIST: FireAndRehireEvidenceKey[] = [
  'insolvency_risk',
  'going_concern_evidence',
  'accounts',
  'consultation_records',
  'alternatives_considered',
  'business_continuity_evidence',
];

export type FireAndRehireAssessment = {
  highRisk: boolean;
  financial_necessity_claimed: FinancialNecessityClaimed;
  /** Evidence categories that should be requested / reviewed before accepting a necessity defence */
  evidence_required: FireAndRehireEvidenceKey[];
  /** True when employer asserts necessity but no supporting evidence is recorded */
  financial_necessity_unsupported: boolean;
  flags: string[];
};

export type FireAndRehireInput = {
  dismissalAndReengagementPattern: boolean;
  imposedRestrictedVariation: boolean;
  financial_necessity_claimed: FinancialNecessityClaimed;
  /** Keys from FIRE_AND_REHIRE_EVIDENCE_CHECKLIST that the file / intake says are present */
  evidencePresent?: Partial<Record<FireAndRehireEvidenceKey, boolean>>;
};

export function assessFireAndRehire(input: FireAndRehireInput): FireAndRehireAssessment {
  const flags: string[] = [];
  const triggered = input.dismissalAndReengagementPattern || input.imposedRestrictedVariation;

  if (triggered) {
    flags.push('possible_dismissal_reengagement_or_restricted_variation');
  }

  const evidence_required = [...FIRE_AND_REHIRE_EVIDENCE_CHECKLIST];
  const present = input.evidencePresent ?? {};
  const hasAnyEvidence = evidence_required.some((k) => present[k] === true);

  const financial_necessity_unsupported =
    input.financial_necessity_claimed === true && !hasAnyEvidence;

  if (input.financial_necessity_claimed === true && !hasAnyEvidence) {
    flags.push('financial_necessity_claimed_without_evidence');
  }

  return {
    highRisk: triggered,
    financial_necessity_claimed: input.financial_necessity_claimed,
    evidence_required,
    financial_necessity_unsupported,
    flags,
  };
}

/** Do not treat financial necessity as established without corroborating material */
export function isFinancialNecessityAcceptedWithoutEvidence(input: FireAndRehireInput): boolean {
  const a = assessFireAndRehire(input);
  return a.financial_necessity_claimed === true && a.financial_necessity_unsupported;
}
