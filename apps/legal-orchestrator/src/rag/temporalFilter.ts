/** Priority order for deriving law-as-at from structured facts (most specific first). */
export const APPLICABLE_LEGAL_DATE_FIELD_ORDER = [
  "dismissal_date",
  "resignation_date",
  "discrimination_act_date",
  "incident_date",
  "employment_end_date",
  "employment_start_date",
  "grievance_date",
  "appeal_deadline",
  "acas_certificate_date",
] as const;

export interface ApplicableLegalDateResult {
  applicableDate?: string;
  sourceField?: string;
  warnings: string[];
}

function normaliseDateInput(raw: string): string | undefined {
  const s = raw.trim();
  if (s.length === 0) return undefined;
  if (/^\d{4}$/.test(s) || /^\d{4}-\d{2}$/.test(s)) return undefined;
  const iso = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return iso;
}

export function deriveApplicableLegalDate(input: { facts: Record<string, unknown> }): ApplicableLegalDateResult {
  const warnings: string[] = [];
  const facts = input.facts ?? {};

  for (const field of APPLICABLE_LEGAL_DATE_FIELD_ORDER) {
    const v = facts[field];
    if (v === null || v === undefined) continue;
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;

    const iso = normaliseDateInput(trimmed);
    if (iso) {
      return { applicableDate: iso, sourceField: field, warnings };
    }

    warnings.push(`ignored_malformed_field:${field}`);
  }

  return { warnings };
}

export function deriveApplicableOnFromFacts(facts: Record<string, unknown>): string | undefined {
  return deriveApplicableLegalDate({ facts }).applicableDate;
}

/** ISO YYYY-MM-DD lexical compare is valid for Gregorian dates. */
export function isChunkApplicableOn(
  applicableOn: string,
  effectiveDate?: string,
  applicableTo?: string
): boolean {
  const on = applicableOn.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return true;

  if (effectiveDate) {
    const eff = effectiveDate.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(eff) && eff > on) return false;
  }

  if (applicableTo) {
    const to = applicableTo.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to) && to < on) return false;
  }

  return true;
}
