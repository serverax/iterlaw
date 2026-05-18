export type OcrResult = {
  text: string;
  provider: 'azure' | 'stub';
  confidence: number;
};

export type OcrServiceOptions = {
  endpoint?: string;
  apiKey?: string;
};

export class OcrService {
  private endpoint: string;
  private apiKey: string;

  constructor(opts: OcrServiceOptions = {}) {
    this.endpoint = opts.endpoint ?? process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT ?? '';
    this.apiKey = opts.apiKey ?? process.env.AZURE_DOC_INTELLIGENCE_KEY ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  async extractText(buffer: Buffer, filename: string): Promise<OcrResult> {
    if (!this.isConfigured()) {
      return {
        text: `OCR stub for ${filename} (${buffer.length} bytes)`,
        provider: 'stub',
        confidence: 0.5,
      };
    }

    // Production: call Azure Document Intelligence analyze API.
    return {
      text: `Azure OCR placeholder for ${filename}`,
      provider: 'azure',
      confidence: 0.9,
    };
  }
}
