const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'as',
  'by',
  'with',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'i',
  'my',
  'me',
  'we',
  'our',
  'you',
  'your',
  'they',
  'their',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'when',
  'where',
  'why',
  'how',
  'if',
  'then',
  'than',
  'so',
  'not',
  'no',
  'yes',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'once',
  'here',
  'there',
  'all',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'only',
  'own',
  'same',
  'too',
  'very',
  'just',
  'also',
  'now',
]);

export function extractKeywords(question: string): string[] {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

export function calculateRelevance(question: string, text: string): number {
  const qWords = extractKeywords(question);
  if (qWords.length === 0) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const w of qWords) {
    if (hay.includes(w)) hits += 1;
  }
  const ratio = hits / qWords.length;
  return Math.min(1, Math.max(0, Number(ratio.toFixed(4))));
}

/** Best-effort UK employer name extraction (Ltd, LLP, PLC, etc.) */
export function extractCompanyName(question: string): string | undefined {
  const patterns = [
    /(?:at|for|from|employer|company)\s+([A-Z0-9&][A-Za-z0-9&'.\-\s]{1,80}?)\s+(?:Ltd|Limited|PLC|LLP|UK|Group)/i,
    /\b([A-Z][A-Za-z0-9&'.\-\s]{1,60}?(?:\s+(?:Ltd|Limited|PLC|LLP)))\b/,
  ];
  for (const re of patterns) {
    const m = question.match(re);
    if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim();
  }
  return undefined;
}
