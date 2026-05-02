import { classifyQuestion } from '../gate';

jest.mock('../gemini', () => ({
  geminiGenerateText: jest.fn(),
}));

import { geminiGenerateText } from '../gemini';

const mockedGemini = geminiGenerateText as jest.MockedFunction<typeof geminiGenerateText>;

describe('classifyQuestion', () => {
  beforeEach(() => {
    mockedGemini.mockReset();
    delete process.env.GOOGLE_AI_API_KEY;
  });

  it('defaults to IN_SCOPE_COMPLEX when API key missing', async () => {
    const result = await classifyQuestion('What is the minimum wage?', 'england_wales');
    expect(result.classification).toBe('IN_SCOPE_COMPLEX');
    expect(mockedGemini).not.toHaveBeenCalled();
  });

  it('parses valid JSON classification', async () => {
    process.env.GOOGLE_AI_API_KEY = 'test';
    mockedGemini.mockResolvedValue({
      text: JSON.stringify({ class: 'OUT_OF_SCOPE', reasoning: 'immigration' }),
    });

    const result = await classifyQuestion('How do I get a visa?', 'england_wales');
    expect(result.classification).toBe('OUT_OF_SCOPE');
    expect(mockedGemini).toHaveBeenCalled();
  });

  it('defaults on invalid class value', async () => {
    process.env.GOOGLE_AI_API_KEY = 'test';
    mockedGemini.mockResolvedValue({
      text: JSON.stringify({ class: 'NOT_A_CLASS', reasoning: 'bad' }),
    });

    const result = await classifyQuestion('any', 'england_wales');
    expect(result.classification).toBe('IN_SCOPE_COMPLEX');
  });
});
