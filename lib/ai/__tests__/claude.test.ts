import axios from 'axios';
import { askClaudeSonnet } from '../claude';

jest.mock('axios');

const mockPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('askClaudeSonnet', () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    mockPost.mockReset();
  });

  afterEach(() => {
    if (prevKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(askClaudeSonnet('Can I be dismissed?', { jurisdiction: 'england_wales' })).rejects.toThrow(
      'ANTHROPIC_API_KEY is not set'
    );
  });

  it('returns a normalised AIResponse from JSON text block', async () => {
    const payload = {
      law_section: 'Employment Rights Act 1996, Section 94',
      meaning: 'Plain meaning.',
      action: 'Contact ACAS.',
      source_citation: 'ERA 1996 s94',
      confidence_score: 0.82,
    };
    mockPost.mockResolvedValue({
      data: {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    });

    const result = await askClaudeSonnet('Unfair dismissal?', {
      jurisdiction: 'england_wales',
      situation_type: 'dismissal',
      employment_dates: '2020–2024',
    });

    expect(result).toMatchObject({
      law_section: payload.law_section,
      meaning: payload.meaning,
      action: payload.action,
      source_citation: payload.source_citation,
      confidence_score: 0.82,
    });
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        model: expect.any(String),
        messages: expect.any(Array),
      }),
      expect.objectContaining({
        timeout: expect.any(Number),
        headers: expect.objectContaining({
          'x-api-key': 'test-anthropic-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
  });

  it('throws when Claude returns no text content', async () => {
    mockPost.mockResolvedValue({ data: { content: [{ type: 'tool_use', id: 'x', name: 'n', input: {} }] } });
    await expect(askClaudeSonnet('q', { jurisdiction: 'england_wales' })).rejects.toThrow(
      'No text content in Claude response'
    );
  });
});
