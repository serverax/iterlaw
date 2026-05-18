/** Sprint 51+ — Zone 2 document intelligence contract (stubbed). */

export interface Zone2OcrResult {
  readonly text: string;
  readonly confidence: number;
  readonly timedOut: boolean;
}

export interface Zone2EmbeddingBatch {
  readonly vectors: readonly (readonly number[])[];
}

export interface Zone2SynthesisResult {
  readonly answerText: string;
  readonly lawSection: string;
  readonly meaning: string;
  readonly action: string;
  readonly confidence: number;
}

export interface Zone2OcrRequest {
  readonly storageKey: string;
  readonly mimeType: string;
  readonly content?: Buffer;
}

export interface Zone2DocumentService {
  runDocumentOcr(request: Zone2OcrRequest): Promise<Zone2OcrResult>;
  embedTexts(texts: readonly string[]): Promise<Zone2EmbeddingBatch>;
  synthesizeCitedAnswer(
    question: string,
    chunkTexts: readonly string[],
  ): Promise<Zone2SynthesisResult>;
}
