import type {
  Zone2DocumentService,
  Zone2EmbeddingBatch,
  Zone2OcrRequest,
  Zone2OcrResult,
  Zone2SynthesisResult,
} from "./zone2DocumentTypes.js";

/** Deterministic stub OCR (Azure Document Intelligence stand-in). */
export class Zone2DocumentServiceStub implements Zone2DocumentService {
  async runDocumentOcr(request: Zone2OcrRequest): Promise<Zone2OcrResult> {
    const key = request.storageKey.trim();
    if (!key) {
      return { text: "", confidence: 0, timedOut: false };
    }
    const fromContent = request.content?.length
      ? request.content.toString("utf8").slice(0, 5000)
      : "";
    return {
      text: fromContent || `[stub-ocr:${request.mimeType}] ${key}`,
      confidence: fromContent ? 0.88 : 0.85,
      timedOut: false,
    };
  }

  async embedTexts(texts: readonly string[]): Promise<Zone2EmbeddingBatch> {
    const vectors = texts.map((t, i) => {
      const dim = 8;
      const v: number[] = [];
      for (let d = 0; d < dim; d += 1) {
        v.push(((t.length + i + d) % 97) / 97);
      }
      return v;
    });
    return { vectors };
  }

  async synthesizeCitedAnswer(question: string, chunkTexts: readonly string[]): Promise<Zone2SynthesisResult> {
    const joined = chunkTexts.slice(0, 3).join(" ").slice(0, 200);
    return {
      answerText: `Stub answer for: ${question.slice(0, 80)}`,
      lawSection: "Stub legislation reference",
      meaning: joined || "No chunks supplied",
      action: "Review cited document sections",
      confidence: 0.8,
    };
  }
}
