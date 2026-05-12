import type { ExtractedCitation, LegalDocumentChunk, NormalisedLegalDocument } from "./types";

function dedupeKey(c: ExtractedCitation): string {
  if (c.statuteTitle) return `statute:${c.statuteTitle}`;
  if (c.neutralCitation) return `neutral:${c.neutralCitation}`;
  if (c.sectionReference && c.citationType === "section_reference") return `sec:${c.sectionReference}`;
  return `${c.citationType}:${c.citationText}`;
}

export function extractCitations(
  doc: NormalisedLegalDocument,
  chunks: LegalDocumentChunk[]
): ExtractedCitation[] {
  const out: ExtractedCitation[] = [];
  const seen = new Set<string>();

  const push = (c: ExtractedCitation) => {
    const k = dedupeKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };

  const scan = (text: string, meta?: Record<string, unknown>) => {
    if (!text || text.trim().length === 0) return;

    if (/Employment Rights Act\s+1996/i.test(text)) {
      push({
        citationText: "Employment Rights Act 1996",
        citationType: "statute",
        statuteTitle: "Employment Rights Act 1996",
        metadata: meta,
      });
    }
    if (/Equality Act\s+2010/i.test(text)) {
      push({
        citationText: "Equality Act 2010",
        citationType: "statute",
        statuteTitle: "Equality Act 2010",
        metadata: meta,
      });
    }
    if (/ACAS\s+Code\s+of\s+Practice\s+on\s+Disciplinary/i.test(text)) {
      push({
        citationText: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
        citationType: "acas_code",
        metadata: meta,
      });
    }

    const secRe = /\bSection\s+(\d+(?:\([^)]+\))?)/gi;
    let m: RegExpExecArray | null;
    while ((m = secRe.exec(text)) !== null) {
      push({
        citationText: m[0]!,
        citationType: "section_reference",
        sectionReference: m[1]!,
        metadata: meta,
      });
    }
    const sRe = /\bs\.\s*(\d+(?:\([^)]+\))?)/gi;
    while ((m = sRe.exec(text)) !== null) {
      push({
        citationText: m[0]!,
        citationType: "section_reference",
        sectionReference: m[1]!,
        metadata: meta,
      });
    }

    const regM = /\bregulation\s+(\d+(?:\([^)]+\))?)/i.exec(text);
    if (regM) {
      push({
        citationText: regM[0]!,
        citationType: "regulation",
        sectionReference: regM[1]!,
        metadata: meta,
      });
    }

    const neuRe = /\[\d{4}\]\s+[A-Z]+(?:\s+[A-Za-z]+)*\s+\d+/g;
    let nm: RegExpExecArray | null;
    while ((nm = neuRe.exec(text)) !== null) {
      push({
        citationText: nm[0]!,
        citationType: "neutral_citation",
        neutralCitation: nm[0]!,
        metadata: meta,
      });
    }
  };

  scan(doc.cleanText, undefined);
  for (const ch of chunks) {
    const meta: Record<string, unknown> = { ...(ch.metadata ?? {}), chunk_index: ch.chunkIndex };
    scan(ch.chunkText, meta);
  }

  return out;
}
