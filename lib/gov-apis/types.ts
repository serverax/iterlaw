export type GovAPISource =
  | 'GOV_UK'
  | 'LEGISLATION'
  | 'CASELAW'
  | 'DATA_GOV'
  | 'COMPANIES_HOUSE';

export interface GovAPIResult {
  title: string;
  content: string;
  url: string;
  source: GovAPISource;
  relevanceScore: number;
  jurisdiction: string;
  citeAs: string;
}

export interface GovOrchestrationMetadata {
  startedAt: string;
  finishedAt: string;
  queryMs: number;
  apiSuccessCounts: Record<GovAPISource, number>;
  errors: { source: GovAPISource; message: string }[];
}

export interface GovOrchestrationResponse {
  results: GovAPIResult[];
  metadata: GovOrchestrationMetadata;
}
