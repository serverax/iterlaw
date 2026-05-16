export type PipelineStage =
  | "upload"
  | "ocr"
  | "entities"
  | "parse"
  | "classify"
  | "chunk"
  | "embed"
  | "search"
  | "answer"
  | "complete";

export interface PipelineRunRecord {
  readonly uploadId: string;
  readonly stage: PipelineStage;
  readonly status: "pending" | "running" | "success" | "failed";
  readonly latencyMs: number;
}

export const PIPELINE_STAGE_ORDER: readonly PipelineStage[] = [
  "upload",
  "ocr",
  "entities",
  "parse",
  "classify",
  "chunk",
  "embed",
  "search",
  "answer",
  "complete",
];

/** Sprint 58 — End-to-end document intelligence integration markers. */
export class DocumentIntelIntegrationPhase58Band {
  nextStage(current: PipelineStage): PipelineStage | null {
    const idx = PIPELINE_STAGE_ORDER.indexOf(current);
    if (idx < 0 || idx >= PIPELINE_STAGE_ORDER.length - 1) {
      return null;
    }
    return PIPELINE_STAGE_ORDER[idx + 1] ?? null;
  }

  recordStage(uploadId: string, stage: PipelineStage, latencyMs: number): PipelineRunRecord {
    return { uploadId, stage, status: "success", latencyMs };
  }

  meetsUploadLatencyTarget(latencyMs: number): boolean {
    return latencyMs < 5_000;
  }

  meetsSearchLatencyTarget(latencyMs: number): boolean {
    return latencyMs < 1_000;
  }
}
