import type { NormalizedDocument, TextChunk } from "./types";

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX = 3500;
const DEFAULT_OVERLAP = 200;

/** Fixed-size windowing with overlap — deterministic, no ML. */
export function chunkDocument(doc: NormalizedDocument, opts?: ChunkOptions): TextChunk[] {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX;
  const overlap = Math.min(opts?.overlapChars ?? DEFAULT_OVERLAP, Math.floor(maxChars / 4));
  const text = doc.text;
  if (text.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let idx = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({ chunkIndex: idx, text: slice });
      idx++;
    }
    if (end >= text.length) break;
    const next = Math.max(end - overlap, start + 1);
    start = next <= start ? end : next;
  }
  return chunks;
}
