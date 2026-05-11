import type { NormalizedDocument, RegistryEntry } from "./types";

/** Strip boilerplate noise lightly — no HTML parser in skeleton. */
export function normalizeDocument(entry: RegistryEntry, rawBody: string): NormalizedDocument {
  let text = rawBody;
  // If it looks like HTML, strip tags crudely (ingestion proper will use a real parser later).
  if (/<html[\s>]/i.test(text) || /<!doctype html>/i.test(text)) {
    text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
    text = text.replace(/<[^>]+>/g, " ");
  }
  text = text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    title: entry.title,
    canonicalUrl: entry.canonicalUrl,
    text,
  };
}
