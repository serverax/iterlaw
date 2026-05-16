/** Bucket entity extractor confidence. */
export function scoreEntityConfidence(conf: number): "low" | "med" | "high" {
  const c = Math.min(1, Math.max(0, conf));
  if (c < 0.34) {
    return "low";
  }
  if (c < 0.67) {
    return "med";
  }
  return "high";
}

/** Jaccard similarity on whitespace token sets (chunk boundary coherence proxy). */
export function chunkCoherenceScore(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 && tb.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const w of ta) {
    if (tb.has(w)) {
      inter += 1;
    }
  }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Allowed upload MIME gate (aligns with Sprint 21 doc slice; centralised here). */
export function documentUploadMimeAllowed(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  return (
    m === "application/pdf" ||
    m === "text/plain" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}
