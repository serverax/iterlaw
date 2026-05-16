import type { Zone2DocumentService, Zone2EmbeddingBatch, Zone2OcrResult, Zone2SynthesisResult } from "./zone2DocumentTypes.js";

/** Deterministic stub OCR (Azure Document Intelligence stand-in). */
export class Zone2DocumentServiceStub implements Zone2DocumentService {
  async runDocumentOcr(storageKey: string, mimeType: string): Promise<Zone2OcrResult> {
    const key = storageKey.trim();
    if (!key) {
      return { text: "", confidence: 0, timedOut: false };
    }
    return {
      text: `[stub-ocr:${mimeType}] ${key}`,
      confidence: 0.85,
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
