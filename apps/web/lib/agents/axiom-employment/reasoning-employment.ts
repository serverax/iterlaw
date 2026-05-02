import type { AxiomTrace, LegalFact, ReasoningStep } from '@/types';
import { ART_EMPLOYMENT_ACAS_SYSTEM_PROMPT } from '@/lib/prompts/art-employment-acas';

export interface StatutoryAnchor {
  citation: string;
  summary: string;
}

/** Thirteen core UK employment statutes / instruments (statutory anchors for ART). */
export const EMPLOYMENT_STATUTORY_ANCHORS: StatutoryAnchor[] = [
  { citation: 'Employment Rights Act 1996', summary: 'Unfair dismissal, redundancy payments, notice.' },
  { citation: 'Equality Act 2010', summary: 'Discrimination, harassment, victimisation at work.' },
  { citation: 'National Minimum Wage Act 1998', summary: 'Minimum pay rates and enforcement.' },
  { citation: 'Working Time Regulations 1998', summary: 'Hours, rest breaks, annual leave.' },
  { citation: 'Transfer of Undertakings (Protection of Employment) Regulations 2006', summary: 'TUPE transfers and employee rights.' },
  { citation: 'Employment Relations Act 1999', summary: 'Union recognition, industrial action framework.' },
  { citation: 'Trade Union and Labour Relations (Consolidation) Act 1992', summary: 'Collective consultation and industrial relations.' },
  { citation: 'Health and Safety at Work etc. Act 1974', summary: 'Employer duties for safe workplaces.' },
  { citation: 'Maternity and Parental Leave etc. Regulations 1999', summary: 'Family-related leave entitlements.' },
  { citation: 'Part-time Workers (Prevention of Less Favourable Treatment) Regulations 2000', summary: 'Part-time worker comparators.' },
  { citation: 'Fixed-term Employees (Prevention of Less Favourable Treatment) Regulations 2002', summary: 'Fixed-term worker protections.' },
  { citation: 'Agency Workers Regulations 2010', summary: 'Agency worker day-one rights and qualifying period.' },
  { citation: 'Employment Tribunals Act 1996', summary: 'Tribunal procedure and time limits (contextual).' },
];

export function statutoryContextBlock(anchors: StatutoryAnchor[] = EMPLOYMENT_STATUTORY_ANCHORS): string {
  return anchors
    .map((a, i) => `${i + 1}. ${a.citation} — ${a.summary}`)
    .join('\n');
}

function pickPrimaryAnchor(facts: LegalFact[]): StatutoryAnchor {
  const fallback: StatutoryAnchor = EMPLOYMENT_STATUTORY_ANCHORS[0] ?? {
    citation: 'Employment Rights Act 1996',
    summary: 'Core UK employment rights and procedures.',
  };
  const blob = facts.map((f) => `${f.label} ${f.value}`).join(' ').toLowerCase();
  if (blob.includes('discriminat') || blob.includes('harass')) {
    return EMPLOYMENT_STATUTORY_ANCHORS[1] ?? fallback;
  }
  if (blob.includes('wage') || blob.includes('minimum pay') || blob.includes('nmw')) {
    return EMPLOYMENT_STATUTORY_ANCHORS[2] ?? fallback;
  }
  if (blob.includes('holiday') || blob.includes('leave') || blob.includes('hours')) {
    return EMPLOYMENT_STATUTORY_ANCHORS[3] ?? fallback;
  }
  if (blob.includes('transfer') || blob.includes('tupe')) {
    return EMPLOYMENT_STATUTORY_ANCHORS[4] ?? fallback;
  }
  return fallback;
}

function meritFromFacts(facts: LegalFact[]): number {
  const confirmed = facts.filter((f) => f.userConfirmed).length;
  const base = 48 + Math.min(40, facts.length * 4) + confirmed * 3;
  return Math.min(92, Math.max(38, Math.round(base)));
}

/**
 * ART — employment-law reasoning trace (5-step structure + merit score).
 */
export function traceEmploymentLaw(
  caseId: string,
  facts: LegalFact[],
  jurisdiction: AxiomTrace['jurisdiction']
): AxiomTrace {
  const primary = pickPrimaryAnchor(facts);
  const meritScore = meritFromFacts(facts);
  const factDigest = facts
    .slice(0, 8)
    .map((f) => `- ${f.label}: ${f.value.slice(0, 220)}${f.value.length > 220 ? '…' : ''}`)
    .join('\n');

  const steps: ReasoningStep[] = [
    {
      step: 1,
      title: 'Issue framing',
      summary: `Facts are organised for a ${jurisdiction.replace(/_/g, ' ')} context. Key narrative:\n${factDigest}`,
    },
    {
      step: 2,
      title: 'Statutory map',
      summary: `Primary statutory anchor: ${primary.citation}. ${primary.summary}`,
      statutoryAnchor: primary.citation,
    },
    {
      step: 3,
      title: 'Tests and thresholds',
      summary:
        'Tribunal time limits, qualifying service, and employer defences are fact-specific. This trace flags where those thresholds commonly arise without deciding them.',
      statutoryAnchor: 'Employment Tribunals Act 1996 / ET procedure rules (context)',
    },
    {
      step: 4,
      title: 'Merits and risks',
      summary:
        'Strength depends on documentary evidence, chronology consistency, and whether procedures were followed. Neutral risks include limitation dates and credibility disputes.',
    },
    {
      step: 5,
      title: 'Practical next steps (informational)',
      summary:
        'ACAS early conciliation may be relevant before many tribunal claims. Internal grievance processes and document retention are commonly important. Verify dates against official guidance.',
    },
  ];

  return {
    caseId,
    steps,
    meritScore,
    jurisdiction,
    generatedAt: new Date().toISOString(),
  };
}

export function artEmploymentSystemBundle(): { systemPrompt: string; anchors: string } {
  return {
    systemPrompt: ART_EMPLOYMENT_ACAS_SYSTEM_PROMPT,
    anchors: statutoryContextBlock(),
  };
}
