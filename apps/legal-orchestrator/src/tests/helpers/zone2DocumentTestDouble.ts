import type { Zone2DocumentService, Zone2EmbeddingBatch, Zone2OcrResult, Zone2SynthesisResult } from "../../coherentSystem/zone2DocumentTypes.js";

export function delegatingZone2Document(overrides: Partial<Zone2DocumentService> = {}): Zone2DocumentService {
  return {
    async runDocumentOcr(request: import("../../coherentSystem/zone2DocumentTypes.js").Zone2OcrRequest): Promise<Zone2OcrResult> {
      return overrides.runDocumentOcr?.(request) ?? { text: "delegated", confidence: 0.9, timedOut: false };
    },
    async embedTexts(texts: readonly string[]): Promise<Zone2EmbeddingBatch> {
      return overrides.embedTexts?.(texts) ?? { vectors: texts.map(() => [0.1, 0.2]) };
    },
    async synthesizeCitedAnswer(question: string, chunkTexts: readonly string[]): Promise<Zone2SynthesisResult> {
      return (
        overrides.synthesizeCitedAnswer?.(question, chunkTexts) ?? {
          answerText: "delegated",
          lawSection: "LAW",
          meaning: "MEANING",
          action: "ACTION",
          confidence: 0.75,
        }
      );
    },
  };
}
