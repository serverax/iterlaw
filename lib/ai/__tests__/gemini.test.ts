import axios from 'axios';
import { askGeminiFlash, geminiGenerateText } from '../gemini';

jest.mock('axios');

const mockPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('geminiGenerateText', () => {
  const prevKey = process.env.GOOGLE_AI_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = 'test-google-key';
    mockPost.mockReset();
  });

  afterEach(() => {
    if (prevKey === undefined) {
      delete process.env.GOOGLE_AI_API_KEY;
    } else {
      process.env.GOOGLE_AI_API_KEY = prevKey;
    }
  });

  it('throws when GOOGLE_AI_API_KEY is missing', async () => {
    delete process.env.GOOGLE_AI_API_KEY;
    await expect(
      geminiGenerateText({
        systemPrompt: 'sys',
        userPrompt: 'user',
        maxOutputTokens: 50,
        timeoutMs: 5000,
      })
    ).rejects.toThrow('GOOGLE_AI_API_KEY is not set');
  });

  it('throws on empty model text', async () => {
    mockPost.mockResolvedValue({ data: { candidates: [{ content: { parts: [{ text: '   ' }] } }] } });
    await expect(
      geminiGenerateText({
        systemPrompt: 's',
        userPrompt: 'u',
        maxOutputTokens: 10,
        timeoutMs: 5000,
      })
    ).rejects.toThrow('Empty Gemini response');
  });

  it('returns text and usage metadata when present', async () => {
    mockPost.mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8 },
      },
    });

    const out = await geminiGenerateText({
      systemPrompt: 's',
      userPrompt: 'u',
      maxOutputTokens: 64,
      timeoutMs: 4000,
      responseMimeType: 'application/json',
    });

    expect(out.text).toBe('{"ok":true}');
    expect(out.promptTokens).toBe(12);
    expect(out.completionTokens).toBe(8);
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringMatching(/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/),
      expect.objectContaining({
        generationConfig: expect.objectContaining({ responseMimeType: 'application/json' }),
      }),
      expect.objectContaining({ params: { key: 'test-google-key' }, timeout: 4000 })
    );
  });
});

describe('askGeminiFlash', () => {
  const prevKey = process.env.GOOGLE_AI_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = 'test-google-key';
    mockPost.mockReset();
  });

  afterEach(() => {
    if (prevKey === undefined) {
      delete process.env.GOOGLE_AI_API_KEY;
    } else {
      process.env.GOOGLE_AI_API_KEY = prevKey;
    }
  });

  it('parses JSON answer from Gemini and normalises fields', async () => {
    const json = JSON.stringify({
      law_section: 'National Minimum Wage Act 1998',
      meaning: 'Employers must pay at least the legal minimum.',
      action: 'Check your payslip against the current rate on GOV.UK.',
      source_citation: 'NMWA 1998',
      confidence_score: 0.9,
    });
    mockPost.mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: json }] } }],
        usageMetadata: {},
      },
    });

    const result = await askGeminiFlash('What is minimum wage?', { jurisdiction: 'england_wales' });
    expect(result.law_section).toContain('National Minimum Wage');
    expect(result.confidence_score).toBe(0.9);
  });
});
