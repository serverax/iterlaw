import { Logger } from '../utils/logger';

const logger = new Logger('OCRService');

export interface OCRResult {
  fullText: string;
  tables: Array<{ rowCount: number; columnCount: number; content: string }>;
  keyPhrases: string[];
  confidence: number;
}

const EMPLOYMENT_KEYWORDS = [
  'redundancy',
  'dismissal',
  'disciplinary',
  'suspension',
  'discrimination',
  'harassment',
  'wages',
  'notice period',
  'unfair dismissal',
  'constructive',
  'gross misconduct',
  'performance',
];

export async function analyzeEmploymentDocument(imageBuffer: Buffer): Promise<OCRResult> {
  const key = process.env.AZURE_COGNITIVE_SERVICES_KEY;
  const endpoint =
    process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT ??
    'https://uksouth.api.cognitive.microsoft.com/';

  if (key) {
    try {
      const { DocumentAnalysisClient, AzureKeyCredential } = await import('@azure/ai-form-recognizer');
      const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
      logger.info('Starting Azure OCR analysis...');
      const poller = await client.beginAnalyzeDocument('prebuilt-document', imageBuffer);
      const result = await poller.pollUntilDone();
      const fullText = result.content ?? '';
      const tables = (result.tables ?? []).map((table) => ({
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        content: table.cells.map((cell) => cell.content ?? '').join(' | '),
      }));
      const keyPhrases = EMPLOYMENT_KEYWORDS.filter((kw) =>
        fullText.toLowerCase().includes(kw.toLowerCase())
      );
      return {
        fullText,
        tables,
        keyPhrases,
        confidence: fullText.length > 0 ? 0.95 : 0.7,
      };
    } catch (err) {
      logger.error('Azure OCR failed, using stub', err);
    }
  }

  const stubText = `OCR stub for document (${imageBuffer.length} bytes)`;
  return {
    fullText: stubText,
    tables: [],
    keyPhrases: EMPLOYMENT_KEYWORDS.filter((kw) => stubText.includes(kw)),
    confidence: 0.5,
  };
}

export async function extractIssuesFromDocument(ocrResult: OCRResult): Promise<string[]> {
  const issues: string[] = [];
  const issuePatterns: Record<string, RegExp> = {
    unfairDismissal: /dismissed|termination|terminated|removed/i,
    discrimination: /discrimination|discriminat|prejudice|bias/i,
    harassment: /harassment|harassed|bullying|abusive/i,
    whistleblowing: /whistleblow|protected disclosure|public interest/i,
    redundancy: /redundancy|redundant|made redundant|job eliminated/i,
    wagingDispute: /unpaid|wage|salary|payment|compensation/i,
  };
  for (const [issue, pattern] of Object.entries(issuePatterns)) {
    if (pattern.test(ocrResult.fullText)) issues.push(issue);
  }
  return issues;
}

export class OcrService {
  async extractText(buffer: Buffer, filename: string): Promise<{ text: string; provider: string; confidence: number }> {
    const result = await analyzeEmploymentDocument(buffer);
    return {
      text: result.fullText || `OCR stub for ${filename}`,
      provider: process.env.AZURE_COGNITIVE_SERVICES_KEY ? 'azure' : 'stub',
      confidence: result.confidence,
    };
  }
}
