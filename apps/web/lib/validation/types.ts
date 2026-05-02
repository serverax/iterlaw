import type { GovAPIResult } from '@/lib/gov-apis/types';

/** Normalised source for validation / DB (maps GOV_UK → GOV_API, etc.) */
export type AnswerSourceType = 'GOV_API' | 'LEGISLATION' | 'CASELAW' | 'AI' | 'CACHED';

/** Input to the formatter (Gov/AI/cache). */
export interface AnswerSource {
  title?: string;
  content: string;
  url?: string;
  source: AnswerSourceType;
  citeAs?: string;
  relevanceScore?: number;
}

export interface UserContext {
  jurisdiction: string;
  situation_type?: string;
  employment_dates?: string;
}

/** Three-part answer ready for validation. */
export interface FormattedAnswer {
  law_section: string;
  meaning: string;
  action: string;
  source_citation: string;
  source_url?: string;
  source_type: Exclude<AnswerSourceType, 'CACHED'>;
  confidence_score: number;
}

export interface ValidationResult {
  passed: boolean;
  confidence: number;
  disclaimer?: string;
  errors: string[];
  formatted?: FormattedAnswer;
  /** True when structure is valid but confidence is below the safe threshold. */
  escalate: boolean;
}

export interface UserAnswer {
  law: string;
  meaning: string;
  action: string;
  source: {
    title: string;
    url?: string;
    citation: string;
  };
  confidence: number;
  disclaimer?: string;
  cached: boolean;
}

/** Map Step 4 `GovAPIResult` into formatter input. */
export function govResultToAnswerSource(result: GovAPIResult): AnswerSource {
  const sourceMap: Record<string, AnswerSourceType> = {
    GOV_UK: 'GOV_API',
    LEGISLATION: 'LEGISLATION',
    CASELAW: 'CASELAW',
    DATA_GOV: 'GOV_API',
    COMPANIES_HOUSE: 'GOV_API',
  };

  return {
    title: result.title,
    content: result.content,
    url: result.url,
    source: sourceMap[result.source] ?? 'GOV_API',
    citeAs: result.citeAs,
    relevanceScore: result.relevanceScore,
  };
}
