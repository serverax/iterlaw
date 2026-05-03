import type { RagCitation, RagChunk } from "./rag.types";

export function chunksToCitations(chunks: RagChunk[]): RagCitation[] {
  return chunks.map((c) => ({
    chunkId: c.chunkId,
    sourceId: c.sourceId,
    title: c.title,
    url: c.url,
    jurisdiction: c.jurisdiction,
    date: c.date,
    paragraphRef: c.paragraphRef,
    summary: c.summary,
  }));
}

export function markUncited(proposition: string): RagCitation {
  return {
    chunkId: "uncited",
    sourceId: "uncited",
    title: "Uncited proposition (requires solicitor review)",
    url: "",
    jurisdiction: "UK",
    summary: proposition.slice(0, 400),
  };
}

export function mergeCitations(primary: RagCitation[], extra: RagCitation[]): RagCitation[] {
  const seen = new Set<string>();
  const out: RagCitation[] = [];
  for (const c of [...primary, ...extra]) {
    const k = `${c.chunkId}:${c.paragraphRef ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
