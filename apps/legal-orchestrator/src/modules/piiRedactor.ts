// piiRedactor — deterministic redaction of email, UK phone, UK NI number,
// and UK postcode. Pure function. No model required.
//
// Order matters because a postcode can sit inside an address-like string;
// we run more-specific patterns first.

import type {
  PiiRedactorInput,
  PiiRedactorOutput,
  Redaction,
  RedactionType,
} from "./contracts";

interface PatternDef {
  type: RedactionType;
  re: RegExp;
}

const PATTERNS: PatternDef[] = [
  // Email — RFC-5322-ish; not perfect but matches the common cases legal
  // intake forms produce.
  {
    type: "email",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  // UK National Insurance: two prefix letters (excluding D, F, I, Q, U, V
  // in first; O excluded in second; suffix A-D), six digits, suffix letter.
  {
    type: "ni_number",
    re: /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]\b/g,
  },
  // UK postcode — area + district + space (optional) + sector + unit.
  {
    type: "postcode",
    re: /\b[A-PR-UWYZ](?:[0-9]{1,2}|[A-HK-Y][0-9]|[A-HK-Y][0-9][0-9]|[0-9][A-HJKSTUW]|[A-HK-Y][0-9][ABEHMNPRVWXY])\s?[0-9][ABD-HJLNP-UW-Z]{2}\b/g,
  },
  // UK phone — +44 / 0 prefix, then 9-10 digits in flexible spacing.
  {
    type: "phone",
    re: /(?:\+?44|0)\s?(?:\d\s?){9,10}\d/g,
  },
];

export function piiRedactor(input: PiiRedactorInput): PiiRedactorOutput {
  const redactions: Redaction[] = [];
  const counters: Record<RedactionType, number> = {
    email: 0,
    phone: 0,
    ni_number: 0,
    postcode: 0,
  };

  // Collect all matches with their original spans before any substitution
  // so positions reflect the INPUT text.
  type Hit = { type: RedactionType; start: number; end: number; original: string };
  const hits: Hit[] = [];
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(input.text)) !== null) {
      hits.push({
        type: p.type,
        start: m.index,
        end: m.index + m[0].length,
        original: m[0],
      });
    }
  }

  // Resolve overlaps: prefer more-specific (earlier in PATTERNS list).
  // Pass: sort by start, drop a hit if any earlier-kept hit overlaps it.
  hits.sort((a, b) => a.start - b.start || a.end - b.end);
  const kept: Hit[] = [];
  for (const h of hits) {
    const overlapsKept = kept.some((k) => !(h.end <= k.start || h.start >= k.end));
    if (!overlapsKept) kept.push(h);
  }

  // Walk left→right substituting from the ORIGINAL string into a new
  // string, tracking placeholder positions.
  let out = "";
  let cursor = 0;
  for (const h of kept) {
    counters[h.type] += 1;
    const placeholder = `[${h.type.toUpperCase()}_${counters[h.type]}]`;
    out += input.text.slice(cursor, h.start);
    const placeholderStart = out.length;
    out += placeholder;
    redactions.push({
      type: h.type,
      placeholder,
      start: placeholderStart,
      end: placeholderStart + placeholder.length,
      original_length: h.original.length,
    });
    cursor = h.end;
  }
  out += input.text.slice(cursor);

  return { redacted_text: out, redactions };
}
