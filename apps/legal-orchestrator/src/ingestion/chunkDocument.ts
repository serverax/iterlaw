import type { LegalDocumentChunk, NormalisedLegalDocument, NormalizedDocument, TextChunk } from "./types";

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

export interface LegalChunkOptions {
  maxWords?: number;
  overlapWords?: number;
}

const DEFAULT_MAX = 3500;
const DEFAULT_OVERLAP = 200;
const DEFAULT_LEGAL_MAX_WORDS = 200;
const DEFAULT_LEGAL_OVERLAP = 20;

function isNormalisedLegalDocument(doc: unknown): doc is NormalisedLegalDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "cleanText" in doc &&
    "contentHash" in doc &&
    "sourceId" in doc &&
    typeof (doc as NormalisedLegalDocument).cleanText === "string"
  );
}

export function chunkDocument(doc: NormalizedDocument, opts?: ChunkOptions): TextChunk[];
export function chunkDocument(doc: NormalisedLegalDocument, opts?: LegalChunkOptions): LegalDocumentChunk[];
export function chunkDocument(
  doc: NormalizedDocument | NormalisedLegalDocument,
  opts?: ChunkOptions | LegalChunkOptions
): TextChunk[] | LegalDocumentChunk[] {
  if (isNormalisedLegalDocument(doc)) {
    return chunkNormalisedLegalDocument(doc, opts as LegalChunkOptions | undefined);
  }
  return chunkPlainDocument(doc as NormalizedDocument, opts as ChunkOptions | undefined);
}

function chunkPlainDocument(doc: NormalizedDocument, opts?: ChunkOptions): TextChunk[] {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX;
  const overlap = Math.min(opts?.overlapChars ?? DEFAULT_OVERLAP, Math.floor(maxChars / 4));
  const text = doc.text;
  if (text.trim().length === 0) return [];

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

function extractSectionReferenceFromText(t: string): string | undefined {
  const m = /\bSection\s+(\d+(?:\([^)]+\))?)/i.exec(t) ?? /\bs\.\s*(\d+(?:\([^)]+\))?)/i.exec(t);
  return m?.[1];
}

function chunkNormalisedLegalDocument(doc: NormalisedLegalDocument, opts?: LegalChunkOptions): LegalDocumentChunk[] {
  const maxWords = opts?.maxWords ?? DEFAULT_LEGAL_MAX_WORDS;
  const overlapWords = Math.max(0, opts?.overlapWords ?? DEFAULT_LEGAL_OVERLAP);
  const text = doc.cleanText.trim();
  if (text.length === 0) return [];

  const lines = text.split(/\r?\n/);
  const headingStack: string[] = [];
  const segments: { headingPath: string[]; words: string[] }[] = [];
  let curHeading: string[] = [];
  let buf: string[] = [];

  const flushBuf = () => {
    if (buf.length === 0) return;
    segments.push({ headingPath: [...curHeading], words: [...buf] });
    buf = [];
  };

  for (const line of lines) {
    const hm = /^(#{1,6})\s+(.+)$/.exec(line);
    if (hm) {
      flushBuf();
      const level = hm[1]!.length;
      const title = hm[2]!.trim();
      headingStack.splice(level - 1, headingStack.length - (level - 1));
      headingStack[level - 1] = title;
      curHeading = headingStack.filter(Boolean).slice(0, level);
      continue;
    }
    const w = line.trim().split(/\s+/).filter(Boolean);
    if (w.length === 0) {
      flushBuf();
      continue;
    }
    buf.push(...w);
  }
  flushBuf();

  const out: LegalDocumentChunk[] = [];
  let chunkIndex = 0;

  for (const seg of segments) {
    const words = seg.words;
    if (words.length === 0) continue;
    let i = 0;
    while (i < words.length) {
      const slice = words.slice(i, i + maxWords);
      if (slice.length === 0) break;
      const chunkText = slice.join(" ");
      const sectionReference = extractSectionReferenceFromText(chunkText);
      out.push({
        chunkIndex,
        headingPath: [...seg.headingPath],
        chunkText,
        tokenCount: slice.length,
        sectionReference,
        metadata: {},
      });
      chunkIndex++;
      if (i + maxWords >= words.length) break;
      i += Math.max(1, maxWords - overlapWords);
    }
  }

  return out;
}

export const chunkLegalDocument = chunkDocument;
