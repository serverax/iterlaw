import { buildAnswerDocxBuffer } from '@/lib/documents/generate';

describe('buildAnswerDocxBuffer', () => {
  it('produces a non-empty docx buffer', async () => {
    const buf = await buildAnswerDocxBuffer({
      law: 'Employment Rights Act 1996',
      meaning: 'Notice may be required.',
      action: 'Check your contract.',
      source: { title: 'ERA 1996', citation: 'ERA 1996', url: 'https://www.gov.uk/' },
      confidence: 0.88,
      cached: false,
    });
    expect(buf.byteLength).toBeGreaterThan(2000);
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK'); // zip / docx signature
  });
});
