/**
 * SSE payloads for POST /api/axiom/process (Phase 0 Step 8b).
 * One JSON object per `data:` line.
 */

/** Payload before SSE encoding (`timestamp` added in `encodeSseData`). */
export type AxiomStreamEvent =
  | { type: 'init'; message: string; progress: number }
  | { type: 'progress'; step: string; message: string; progress: number }
  | { type: 'data'; partial: Record<string, unknown>; progress: number }
  | { type: 'complete'; phase: 'extract' | 'reason'; result: Record<string, unknown>; durationMs: number }
  | { type: 'error'; message: string; escalate: boolean };

export function encodeSseData(event: AxiomStreamEvent): Uint8Array {
  const line = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;
  return new TextEncoder().encode(line);
}
