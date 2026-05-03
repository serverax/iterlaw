/**
 * Mock retrieval only — no scraping, no Supabase (Phase 1).
 */

import type { RetrievalQuery, RetrievalResult, RagChunk, RagCitation } from "./rag.types";
import { RAG_SOURCE_REGISTRY } from "./sources.config";

export interface RetrievalService {
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}

function keywordScore(text: string, q: string): number {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const t = text.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (t.includes(w)) s += 1;
  }
  return s;
}

const MOCK_CHUNKS: Omit<RagChunk, "chunkId">[] = [
  {
    sourceId: "uk-emp-rights-act-1996",
    title: "ERA 1996 — unfair dismissal",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    jurisdiction: "UK",
    category: "legislation",
    date: "1996-07-22",
    version: "as amended",
    paragraphRef: "s.94(1)",
    summary: "Employees with qualifying service have the right not to be unfairly dismissed; fairness assessed under s.98(4).",
    text:
      "An employee has the right not to be unfairly dismissed by the employer (subject to qualifying service and exceptions). Reasonableness of dismissal is assessed under ERA 1996 s.98(4).",
  },
  {
    sourceId: "uk-eq-act-2010",
    title: "EqA 2010 — direct discrimination",
    url: "https://www.legislation.gov.uk/ukpga/2010/15/section/13",
    jurisdiction: "UK",
    category: "legislation",
    date: "2010-10-01",
    paragraphRef: "s.13",
    summary: "Direct discrimination arises where A treats B less favourably because of a protected characteristic.",
    text:
      "Direct discrimination occurs where A treats B less favourably than A treats or would treat others because of a protected characteristic.",
  },
  {
    sourceId: "acas-code-2024",
    title: "ACAS Code — fairness and investigation",
    url: "https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures",
    jurisdiction: "EW",
    category: "acas",
    date: "2024-03-11",
    paragraphRef: "Principles of fairness",
    summary: "Disciplinary processes should be fair; reasonable investigation; employee knows the case and can respond.",
    text:
      "Disciplinary procedures should be fair and transparent; investigations should be reasonable; employees should know the case against them and have a chance to respond.",
  },
  {
    sourceId: "gov-uk-dismissal",
    title: "GOV.UK — dismissal overview",
    url: "https://www.gov.uk/dismissal",
    jurisdiction: "EW",
    category: "guidance",
    date: "2015-01-01",
    paragraphRef: "Overview",
    summary: "Explains checking fairness, procedure, and tribunal time limits after dismissal.",
    text:
      "If you are dismissed, check whether the dismissal was fair, whether correct procedure was followed, and limitation periods for tribunal claims.",
  },
  {
    sourceId: "eat-burchell",
    title: "Burchell — reasonable investigation",
    url: "https://www.bailii.org/cgi-bin/format.cgi?doc=/cases/UKIAT/1979/1979_IAT_230_79.html",
    jurisdiction: "EW",
    category: "appeal-court",
    date: "1978-01-01",
    paragraphRef: "Burchell test (summary)",
    summary: "Employer belief, reasonable grounds, and reasonable investigation before disciplinary sanction.",
    text:
      "Employer must hold a genuine belief in misconduct; have reasonable grounds for that belief; and have carried out as much investigation as was reasonable in the circumstances.",
  },
  {
    sourceId: "et-open-justice-placeholder",
    title: "ET decisions — illustrative placeholder",
    url: "https://www.gov.uk/employment-tribunal-decisions",
    jurisdiction: "EW",
    category: "tribunal",
    date: "2024-06-01",
    paragraphRef: "Illustrative",
    summary: "Placeholder for indexed Employment Tribunal judgment citations (to be ingested later).",
    text:
      "Employment Tribunal judgments are published for open justice; specific citations should be retrieved from the indexed corpus once ingestion is live.",
  },
];

function toChunk(c: Omit<RagChunk, "chunkId">, i: number): RagChunk {
  return { ...c, chunkId: `chunk_${c.sourceId}_${i}` };
}

function toCitation(c: RagChunk): RagCitation {
  return {
    chunkId: c.chunkId,
    sourceId: c.sourceId,
    title: c.title,
    url: c.url,
    jurisdiction: c.jurisdiction,
    date: c.date,
    paragraphRef: c.paragraphRef,
    summary: c.summary,
  };
}

export class MockRetrievalService implements RetrievalService {
  async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
    const topK = query.topK ?? 6;
    const q = query.queryText || "";

    const scored = MOCK_CHUNKS.map((c, i) => ({
      c: toChunk(c, i),
      score: keywordScore(c.text + " " + c.title + " " + c.summary, q) + (q.length < 8 ? 0.1 : 0),
    }));

    scored.sort((a, b) => b.score - a.score);
    const picked = scored.slice(0, topK).filter((s) => s.score > 0 || q.length < 20);
    const fallback =
      picked.length > 0 ? picked : scored.slice(0, Math.min(2, scored.length));

    const chunks = fallback.map((x) => x.c);
    const citations = chunks.map(toCitation);
    void RAG_SOURCE_REGISTRY;
    return { chunks, citations };
  }
}
