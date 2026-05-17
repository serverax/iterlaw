import type { Zone2DocumentService, Zone2EmbeddingBatch, Zone2OcrRequest, Zone2OcrResult, Zone2SynthesisResult } from "./zone2DocumentTypes.js";
import { Zone2DocumentServiceStub } from "./zone2DocumentStub.js";

export interface AzureDocumentIntelligenceConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly modelId: string;
}

export function readAzureDocumentIntelligenceConfigFromEnv(): AzureDocumentIntelligenceConfig | null {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  if (!endpoint || !apiKey) {
    return null;
  }
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    apiKey,
    apiVersion: process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION?.trim() || "2024-11-30",
    modelId: process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID?.trim() || "prebuilt-document",
  };
}

/**
 * Zone 2 Azure Document Intelligence (REST). Falls back to stub on failure.
 */
export class AzureDocumentIntelligenceZone2 implements Zone2DocumentService {
  private readonly fallback = new Zone2DocumentServiceStub();

  constructor(private readonly config: AzureDocumentIntelligenceConfig) {}

  async runDocumentOcr(request: Zone2OcrRequest): Promise<Zone2OcrResult> {
    if (!request.content?.length) {
      return this.fallback.runDocumentOcr(request);
    }
    try {
      const analyzeUrl = `${this.config.endpoint}/documentintelligence/documentModels/${encodeURIComponent(this.config.modelId)}:analyze?api-version=${encodeURIComponent(this.config.apiVersion)}`;
      const start = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.config.apiKey,
          "Content-Type": request.mimeType || "application/octet-stream",
        },
        body: request.content,
      });
      if (!start.ok) {
        return this.fallback.runDocumentOcr(request);
      }
      const operationLocation = start.headers.get("operation-location");
      if (!operationLocation) {
        return this.fallback.runDocumentOcr(request);
      }
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const poll = await fetch(operationLocation, {
          headers: { "Ocp-Apim-Subscription-Key": this.config.apiKey },
        });
        if (!poll.ok) {
          continue;
        }
        const body = (await poll.json()) as {
          status?: string;
          analyzeResult?: { content?: string };
        };
        if (body.status === "failed") {
          return this.fallback.runDocumentOcr(request);
        }
        if (body.status === "succeeded" && body.analyzeResult?.content) {
          return { text: body.analyzeResult.content, confidence: 0.9, timedOut: false };
        }
      }
      return { text: "", confidence: 0, timedOut: true };
    } catch {
      return this.fallback.runDocumentOcr(request);
    }
  }

  async embedTexts(texts: readonly string[]): Promise<Zone2EmbeddingBatch> {
    return this.fallback.embedTexts(texts);
  }

  async synthesizeCitedAnswer(question: string, chunkTexts: readonly string[]): Promise<Zone2SynthesisResult> {
    return this.fallback.synthesizeCitedAnswer(question, chunkTexts);
  }
}

export function createZone2DocumentService(): Zone2DocumentService {
  const cfg = readAzureDocumentIntelligenceConfigFromEnv();
  if (cfg) {
    return new AzureDocumentIntelligenceZone2(cfg);
  }
  return new Zone2DocumentServiceStub();
}
