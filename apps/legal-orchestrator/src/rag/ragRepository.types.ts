// Side types for ragRepository. Kept in a separate file so the test
// can import the allow-list set without pulling in the SQL strings.

export const ALLOWED_SOURCE_TYPES = new Set<string>([
  "legislation",
  "statutory_instrument",
  "gov_guidance",
  "acas_guidance",
  "tribunal_case",
  "appeal_case",
  "case_law",
  "internal_note",
  "template",
]);

export type SourceTypeWide =
  | "legislation"
  | "statutory_instrument"
  | "gov_guidance"
  | "acas_guidance"
  | "tribunal_case"
  | "appeal_case"
  | "case_law"
  | "internal_note"
  | "template";
