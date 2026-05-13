import { callAIFallback } from '../orchestrate';

jest.mock('../gate', () => ({
  classifyQuestion: jest.fn(),
}));
jest.mock('../gemini', () => ({
  askGeminiFlash: jest.fn(),
}));
jest.mock('../claude', () => ({
  askClaudeSonnet: jest.fn(),
}));

import { askClaudeSonnet } from '../claude';
import { classifyQuestion } from '../gate';
import { askGeminiFlash } from '../gemini';

const mockedClassify = classifyQuestion as jest.MockedFunction<typeof classifyQuestion>;
const mockedGemini = askGeminiFlash as jest.MockedFunction<typeof askGeminiFlash>;
const mockedClaude = askClaudeSonnet as jest.MockedFunction<typeof askClaudeSonnet>;

describe('callAIFallback', () => {
  const prevFlag = process.env.ITERLAW_WEB_AI_FALLBACK_ENABLED;

  beforeEach(() => {
    mockedClassify.mockReset();
    mockedGemini.mockReset();
    mockedClaude.mockReset();
    process.env.ITERLAW_WEB_AI_FALLBACK_ENABLED = 'true';
  });

  afterEach(() => {
    if (prevFlag === undefined) {
      delete process.env.ITERLAW_WEB_AI_FALLBACK_ENABLED;
    } else {
      process.env.ITERLAW_WEB_AI_FALLBACK_ENABLED = prevFlag;
    }
  });

  it('returns null by default (web AI fallback disabled, no provider invoked)', async () => {
    delete process.env.ITERLAW_WEB_AI_FALLBACK_ENABLED;
    await expect(callAIFallback('q', { jurisdiction: 'england_wales' })).resolves.toBeNull();
    expect(mockedClassify).not.toHaveBeenCalled();
    expect(mockedGemini).not.toHaveBeenCalled();
    expect(mockedClaude).not.toHaveBeenCalled();
  });

  it('returns null for ESCALATE', async () => {
    mockedClassify.mockResolvedValue({
      classification: 'ESCALATE',
      reasoning: 'x',
      confidence: 0.9,
    });
    await expect(callAIFallback('tribunal representation', { jurisdiction: 'england_wales' })).resolves.toBeNull();
  });

  it('returns null for OUT_OF_SCOPE', async () => {
    mockedClassify.mockResolvedValue({
      classification: 'OUT_OF_SCOPE',
      reasoning: 'x',
      confidence: 0.9,
    });
    await expect(callAIFallback('visa', { jurisdiction: 'england_wales' })).resolves.toBeNull();
  });

  it('routes SIMPLE to Gemini', async () => {
    mockedClassify.mockResolvedValue({
      classification: 'IN_SCOPE_SIMPLE',
      reasoning: 'x',
      confidence: 0.9,
    });
    mockedGemini.mockResolvedValue({
      law_section: 'ERA 1996',
      meaning: 'Meaning text here',
      action: 'Contact ACAS on 0300 123 1100 for guidance.',
      source_citation: 'ERA 1996',
      confidence_score: 0.8,
    });

    const res = await callAIFallback('minimum wage', { jurisdiction: 'england_wales' });
    expect(mockedGemini).toHaveBeenCalled();
    expect(res?.source_citation).toContain('(AI-assisted)');
  });

  it('routes COMPLEX to Claude', async () => {
    mockedClassify.mockResolvedValue({
      classification: 'IN_SCOPE_COMPLEX',
      reasoning: 'x',
      confidence: 0.9,
    });
    mockedClaude.mockResolvedValue({
      law_section: 'Eq Act 2010',
      meaning: 'Meaning text here',
      action: 'Seek advice from a qualified employment solicitor.',
      source_citation: 'Eq Act 2010',
      confidence_score: 0.8,
    });

    const res = await callAIFallback('discrimination', { jurisdiction: 'england_wales' });
    expect(mockedClaude).toHaveBeenCalled();
    expect(res?.law_section).toContain('Eq');
  });

  it('returns null when model throws', async () => {
    mockedClassify.mockResolvedValue({
      classification: 'IN_SCOPE_SIMPLE',
      reasoning: 'x',
      confidence: 0.9,
    });
    mockedGemini.mockRejectedValue(new Error('boom'));
    await expect(callAIFallback('q', { jurisdiction: 'england_wales' })).resolves.toBeNull();
  });
});
