import type { AnswerSource, FormattedAnswer, UserContext } from './types';

const LAW_PATTERNS = [
  /Employment Rights Act\s+\d{4}/i,
  /Equality Act\s+\d{4}/i,
  /Health and Safety at Work etc\. Act\s+\d{4}/i,
  /Section\s+\d+[A-Z]?/i,
  /Regulation\s+\d+/i,
];

export function extractLawSection(content: string, citeAs?: string): string {
  const trimmed = citeAs?.trim();
  if (trimmed) return trimmed;

  for (const pattern of LAW_PATTERNS) {
    const match = content.match(pattern);
    if (match?.[0]) return match[0].trim();
  }

  return 'UK employment law (official guidance or legislation)';
}

export function formatMeaning(content: string, context?: UserContext): string {
  let text = content
    .replace(/Section\s+\d+[A-Z]?/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (context?.situation_type || context?.employment_dates) {
    const bits: string[] = [];
    if (context.situation_type) bits.push(`situation: ${context.situation_type}`);
    if (context.employment_dates) bits.push(`service: ${context.employment_dates}`);
    const prefix = `Given your ${bits.join(', ')}, `;
    text = `${prefix}${text}`.trim();
  }

  if (text.length > 500) {
    text = `${text.slice(0, 497)}...`;
  }

  return text.length > 0 ? text : 'This material summarises how the law is usually described in official sources.';
}

export function extractAction(source: AnswerSource['source']): string {
  const actions: Record<AnswerSource['source'], string> = {
    GOV_API:
      'Open the GOV.UK page linked below. If you are unsure how it applies, contact ACAS on 0300 123 1100 for free, impartial advice.',
    LEGISLATION:
      'Read the official legislation via the link below. If your situation is not straightforward, speak to a qualified employment solicitor.',
    CASELAW:
      'Use the judgment link below to see how a tribunal applied the law. Legal advice may be needed if your facts differ.',
    AI: 'This section was produced without a live official excerpt. Verify every point using the links provided or with a solicitor before acting.',
    CACHED:
      'Check the cited source and keep a dated copy of any letters or emails you send or receive about this issue.',
  };

  return actions[source];
}

export function formatAnswer(
  govResult: AnswerSource,
  userContext?: UserContext
): FormattedAnswer {
  const { title, content, url, source, citeAs, relevanceScore } = govResult;

  const law_section = extractLawSection(content, citeAs);
  const meaning = formatMeaning(content, userContext);
  const action = extractAction(source);

  const source_citation = (citeAs?.trim() || title?.trim() || 'UK employment law').slice(0, 500);

  const source_type: FormattedAnswer['source_type'] =
    source === 'CACHED' ? 'GOV_API' : source === 'AI' ? 'AI' : source;

  const confidence_score =
    typeof relevanceScore === 'number' && Number.isFinite(relevanceScore)
      ? Math.min(1, Math.max(0, relevanceScore))
      : 0.7;

  return {
    law_section,
    meaning,
    action,
    source_citation,
    source_url: url,
    source_type,
    confidence_score,
  };
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toUserAnswer(
  formatted: FormattedAnswer,
  confidence: number,
  disclaimer?: string
): import('./types').UserAnswer {
  return {
    law: escapeHtml(formatted.law_section),
    meaning: escapeHtml(formatted.meaning),
    action: escapeHtml(formatted.action),
    source: {
      title: escapeHtml(formatted.source_citation),
      url: formatted.source_url,
      citation: escapeHtml(formatted.source_citation),
    },
    confidence,
    disclaimer: disclaimer ? escapeHtml(disclaimer) : undefined,
    cached: false,
  };
}
