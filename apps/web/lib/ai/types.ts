export interface AIResponse {
  law_section: string;
  meaning: string;
  action: string;
  source_citation: string;
  confidence_score: number;
}

export type QuestionClass = 'IN_SCOPE_SIMPLE' | 'IN_SCOPE_COMPLEX' | 'OUT_OF_SCOPE' | 'ESCALATE';

export interface ClassificationResult {
  classification: QuestionClass;
  reasoning: string;
  confidence: number;
}

export interface AIContext {
  jurisdiction: string;
  situation_type?: string;
  employment_dates?: string;
}
