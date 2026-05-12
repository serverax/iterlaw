import { createHash } from "node:crypto";
import type {
  NormalisedLegalDocument,
  NormaliseDocumentResult,
  NormalizedDocument,
  RawLegalDocument,
  RegistryEntry,
  TrustedSource,
} from "./types";
import { assertUrlBelongsToSource, validateTrustedSource } from "./sourceRegistry";

function stripHtmlLike(raw: string): string {
  let text = raw;
  if (/<html[\s>]/i.test(text) || /<!doctype html>/i.test(text)) {
    text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
    text = text.replace(/<[^>]+>/g, " ");
  }
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hashCleanText(canonicalUrl: string, clean: string): string {
  return createHash("sha256").update(canonicalUrl, "utf8").update("\n", "utf8").update(clean, "utf8").digest("hex");
}

function normalizeRegistryEntry(entry: RegistryEntry, rawBody: string): NormalizedDocument {
  const text = stripHtmlLike(rawBody);
  return {
    title: entry.title,
    canonicalUrl: entry.canonicalUrl,
    text,
  };
}

function normalizeRawLegalDocument(raw: RawLegalDocument, source: TrustedSource): NormaliseDocumentResult {
  const srcOk = validateTrustedSource(source);
  if (!srcOk.ok) return { ok: false, code: srcOk.code };

  const urlOk = assertUrlBelongsToSource(raw.canonicalUrl, source);
  if (!urlOk.ok) {
    const code = urlOk.code === "out_of_domain" ? "url_out_of_domain" : urlOk.code;
    return { ok: false, code };
  }

  const maxRaw = parseInt(process.env.INGESTION_MAX_RAW_CHARS ?? "", 10);
  const rawCombined = [raw.rawText ?? "", raw.rawHtml ?? ""].join("\n");
  if (Number.isFinite(maxRaw) && maxRaw > 0 && rawCombined.length > maxRaw) {
    return { ok: false, code: "document_too_large" };
  }

  const fromHtml = raw.rawHtml && raw.rawHtml.length > 0 ? stripHtmlLike(raw.rawHtml) : "";
  const fromText = raw.rawText !== undefined ? stripHtmlLike(String(raw.rawText)) : "";
  const cleanText = (fromHtml.length > 0 ? fromHtml : fromText).trim();
  if (cleanText.length === 0) return { ok: false, code: "empty_content" };

  const document: NormalisedLegalDocument = {
    sourceId: raw.sourceId,
    title: raw.title,
    canonicalUrl: raw.canonicalUrl,
    documentType: raw.documentType,
    jurisdiction: raw.jurisdiction,
    contentHash: hashCleanText(raw.canonicalUrl, cleanText),
    cleanText,
    metadata: {},
  };
  return { ok: true, document };
}

export function normalizeDocument(entry: RegistryEntry, rawBody: string): NormalizedDocument;
export function normalizeDocument(raw: RawLegalDocument, source: TrustedSource): NormaliseDocumentResult;
export function normalizeDocument(
  first: RegistryEntry | RawLegalDocument,
  second: string | TrustedSource
): NormalizedDocument | NormaliseDocumentResult {
  if (typeof second === "string") {
    return normalizeRegistryEntry(first as RegistryEntry, second);
  }
  return normalizeRawLegalDocument(first as RawLegalDocument, second as TrustedSource);
}

export const normaliseDocument = normalizeDocument;
