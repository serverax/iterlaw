jest.mock('@/lib/validation', () => {
  const actual = jest.requireActual<typeof import('@/lib/validation')>('@/lib/validation');
  return {
    ...actual,
    validateAndFormatAnswer: jest.fn(),
  };
});

jest.mock('@/lib/qa-pool/service', () => ({
  findCachedUserAnswer: jest.fn(),
  upsertCachedUserAnswer: jest.fn(async () => ({ ok: true, skipped: true })),
}));

jest.mock('@/lib/answer/cost-log', () => ({
  logAnswerCostEvent: jest.fn(async () => ({ ok: true, skipped: true })),
}));

jest.mock('@/lib/gov-apis/orchestrate', () => ({
  queryAllGovAPIs: jest.fn(),
}));

jest.mock('@/lib/gov-apis/acas-guidance', () => ({
  queryAcasGuidance: jest.fn(),
}));

jest.mock('@/lib/ai/orchestrate', () => ({
  callAIFallback: jest.fn(),
}));

import { callAIFallback } from '@/lib/ai/orchestrate';
import { queryAcasGuidance } from '@/lib/gov-apis/acas-guidance';
import { queryAllGovAPIs } from '@/lib/gov-apis/orchestrate';
import { findCachedUserAnswer } from '@/lib/qa-pool/service';
import { orchestrateAnswer } from '@/lib/answer/orchestrator';
import * as validation from '@/lib/validation';

const meta = {
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  queryMs: 1,
  apiSuccessCounts: {
    GOV_UK: 1,
    LEGISLATION: 0,
    CASELAW: 0,
    DATA_GOV: 0,
    COMPANIES_HOUSE: 0,
  },
  errors: [] as { source: import('@/lib/gov-apis/types').GovAPISource; message: string }[],
};

describe('orchestrateAnswer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    (findCachedUserAnswer as jest.Mock).mockResolvedValue(null);
    (queryAcasGuidance as jest.Mock).mockResolvedValue([]);
  });

  it('returns cache hit without calling Gov APIs', async () => {
    (findCachedUserAnswer as jest.Mock).mockResolvedValue({
      source: 'cache',
      answer: {
        law: 'L',
        meaning: 'M',
        action: 'A',
        source: { title: 't', citation: 'c' },
        confidence: 0.9,
        cached: true,
      },
    });
    const res = await orchestrateAnswer({
      question: 'What is redundancy pay?',
      jurisdiction: 'england_wales',
    });
    expect(res.success).toBe(true);
    expect(res.source).toBe('cache');
    expect(queryAllGovAPIs).not.toHaveBeenCalled();
  });

  it('uses Gov path when validation is shippable', async () => {
    (queryAllGovAPIs as jest.Mock).mockResolvedValue({
      results: [
        {
          title: 'Redundancy',
          content: 'Employment Rights Act 1996 covers redundancy payments for eligible employees.',
          url: 'https://www.gov.uk/redundancy',
          source: 'GOV_UK',
          relevanceScore: 0.95,
          jurisdiction: 'england_wales',
          citeAs: 'ERA 1996',
        },
      ],
      metadata: meta,
    });

    (validation.validateAndFormatAnswer as jest.Mock).mockResolvedValue({
      passed: true,
      confidence: 0.9,
      errors: [],
      escalate: false,
      formatted: {
        law_section: 'ERA 1996',
        meaning: 'Meaning text here for the worker.',
        action: 'One concrete step tonight.',
        source_citation: 'ERA 1996',
        source_url: 'https://www.gov.uk/',
        source_type: 'GOV_API',
        confidence_score: 0.9,
      },
    });

    const res = await orchestrateAnswer({
      question: 'What is redundancy pay?',
      jurisdiction: 'england_wales',
    });

    expect(res.success).toBe(true);
    expect(res.source).toBe('gov');
    expect(res.answer?.law).toContain('ERA');
  });

  it('escalates when AI returns null', async () => {
    (queryAllGovAPIs as jest.Mock).mockResolvedValue({
      results: [],
      metadata: meta,
    });
    (validation.validateAndFormatAnswer as jest.Mock).mockResolvedValue({
      passed: false,
      confidence: 0.2,
      errors: ['x'],
      escalate: true,
    });
    (callAIFallback as jest.Mock).mockResolvedValue(null);

    const res = await orchestrateAnswer({
      question: 'What is redundancy pay?',
      jurisdiction: 'england_wales',
    });

    expect(res.success).toBe(false);
    expect(res.escalate).toBe(true);
  });
});
