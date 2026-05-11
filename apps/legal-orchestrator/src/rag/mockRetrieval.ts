// In-memory RetrievalPort. Used by unit tests so we never touch a live DB.
// Also useful for local dev where DATABASE_URL is unset.

import type { CorpusSourceType, RetrievalQuery } from "./rag.types";
import type { RetrievalPort, RetrievalPortResult, RetrievedLegalChunk } from "./retrieval.port";

export interface MockCorpusChunk extends RetrievedLegalChunk {
  /** Optional: limit which legal_pack this chunk belongs to. */
  legal_pack?: string;
  /** Optional: jurisdiction filter for the chunk. */
  jurisdiction?: string;
  /** Optional: topic tag used when caller passes RetrievalQuery.topic. */
  topics?: string[];
}

export interface MockRetrievalOptions {
  corpus: MockCorpusChunk[];
  /** Default max results if RetrievalQuery.limit is not finite. */
  defaultLimit?: number;
}

function safeLower(s: string | undefined): string {
  return typeof s === "string" ? s.toLowerCase() : "";
}

function chunkMatches(chunk: MockCorpusChunk, q: RetrievalQuery): boolean {
  // legal_pack — strict match if the chunk declares one
  if (chunk.legal_pack && chunk.legal_pack !== q.legal_pack) return false;

  // jurisdiction — strict match if both sides declare one
  if (q.jurisdiction && chunk.jurisdiction && chunk.jurisdiction !== q.jurisdiction) {
    return false;
  }

  // source_types — if filter present, chunk's source_type must be in it
  if (q.source_types && q.source_types.length > 0) {
    if (!q.source_types.includes(chunk.source_type)) return false;
  }

  // topic — if both sides declare topics, intersection must be non-empty
  if (q.topic && chunk.topics && chunk.topics.length > 0) {
    if (!chunk.topics.includes(q.topic)) return false;
  }

  // query_text — substring match across title / citation / chunk_text
  if (q.query_text && q.query_text.trim().length > 0) {
    const needle = safeLower(q.query_text);
    const hay =
      safeLower(chunk.title) +
      " " +
      safeLower(chunk.citation_label) +
      " " +
      safeLower(chunk.chunk_text);
    if (!hay.includes(needle)) {
      // If query is multi-word, try OR-of-words
      const words = needle.split(/\s+/).filter((w) => w.length >= 3);
      if (words.length === 0) return false;
      if (!words.some((w) => hay.includes(w))) return false;
    }
  }

  return true;
}

export class MockRetrieval implements RetrievalPort {
  private readonly corpus: MockCorpusChunk[];
  private readonly defaultLimit: number;

  constructor(opts: MockRetrievalOptions) {
    this.corpus = opts.corpus;
    this.defaultLimit = opts.defaultLimit ?? 10;
  }

  async search(input: RetrievalQuery): Promise<RetrievalPortResult> {
    const notes: string[] = [];
    const limit = Number.isFinite(input.limit) && input.limit > 0 ? input.limit : this.defaultLimit;

    const matched = this.corpus.filter((c) => chunkMatches(c, input));

    // Stable sort: authority_level DESC, then chunk_id ASC.
    matched.sort((a, b) => {
      if (b.authority_level !== a.authority_level) return b.authority_level - a.authority_level;
      return a.chunk_id.localeCompare(b.chunk_id);
    });

    const truncated = matched.slice(0, limit);

    notes.push(`mock_retrieval:matched=${matched.length}`);
    if (matched.length > truncated.length) {
      notes.push(`mock_retrieval:truncated_to=${truncated.length}`);
    }
    if (truncated.length === 0) {
      notes.push("mock_retrieval:no_match");
    }
    if (input.source_types && input.source_types.length > 0) {
      notes.push(`mock_retrieval:source_type_filter=${input.source_types.join(",")}`);
    }
    if (input.jurisdiction) {
      notes.push(`mock_retrieval:jurisdiction=${input.jurisdiction}`);
    }

    return { chunks: truncated, retrieval_notes: notes };
  }
}

// Convenience: a small, paraphrased UK employment-law corpus for tests.
// SHORT PARAPHRASED TEXT ONLY — not actual statutory text.
export const SAMPLE_UK_EMPLOYMENT_CORPUS: MockCorpusChunk[] = [
  {
    chunk_id: "seed-era-s95",
    document_id: "doc-era-1996",
    source_type: "legislation" satisfies CorpusSourceType,
    chunk_index: 0,
    chunk_text:
      "An employee is dismissed when the contract of employment is terminated by the employer, with or without notice, or when the employee resigns in response to a serious breach of contract by the employer.",
    section_reference: "95(1)",
    authority_level: 100,
    title: "Employment Rights Act 1996 — Section 95",
    citation_label: "ERA 1996 s.95(1)",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["unfair_dismissal", "constructive_dismissal"],
  },
  {
    chunk_id: "seed-era-s98",
    document_id: "doc-era-1996",
    source_type: "legislation" satisfies CorpusSourceType,
    chunk_index: 1,
    chunk_text:
      "It is for the employer to show the reason for the dismissal and that the reason is one of the potentially fair reasons including capability, conduct, redundancy, statutory restriction, or some other substantial reason.",
    section_reference: "98",
    authority_level: 100,
    title: "Employment Rights Act 1996 — Section 98",
    citation_label: "ERA 1996 s.98",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/98",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["unfair_dismissal"],
  },
  {
    chunk_id: "seed-acas-disc-2015",
    document_id: "doc-acas-disc-2015",
    source_type: "acas_guidance" satisfies CorpusSourceType,
    chunk_index: 0,
    chunk_text:
      "Employers should follow a fair disciplinary procedure, including a written invitation to the meeting, an opportunity to be accompanied, a reasonable investigation, and a right of appeal.",
    authority_level: 60,
    title: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
    citation_label: "ACAS CoP (Disciplinary and Grievance) 2015",
    url: "https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["disciplinary", "grievance", "unfair_dismissal"],
  },
  {
    chunk_id: "seed-eqa-2010",
    document_id: "doc-eqa-2010",
    source_type: "legislation" satisfies CorpusSourceType,
    chunk_index: 0,
    chunk_text:
      "A person discriminates against another if, because of a protected characteristic, they treat that other less favourably than they treat or would treat another person.",
    section_reference: "13",
    authority_level: 100,
    title: "Equality Act 2010 — Section 13",
    citation_label: "EqA 2010 s.13",
    url: "https://www.legislation.gov.uk/ukpga/2010/15/section/13",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["discrimination", "harassment", "victimisation"],
  },
  {
    chunk_id: "seed-govuk-dismissal",
    document_id: "doc-govuk-dismissal",
    source_type: "gov_guidance" satisfies CorpusSourceType,
    chunk_index: 0,
    chunk_text:
      "If you are dismissed you may have a right to claim unfair dismissal at an Employment Tribunal. There are time limits and ACAS Early Conciliation is normally required first.",
    authority_level: 50,
    title: "Dismissal: an overview (GOV.UK)",
    citation_label: "GOV.UK Dismissal Overview",
    url: "https://www.gov.uk/dismissal",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["unfair_dismissal"],
  },
];
