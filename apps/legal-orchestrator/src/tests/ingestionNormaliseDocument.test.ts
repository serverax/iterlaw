// Sprint 11 — normaliseDocument unit tests.
// No network, no DB, no LLM.

import { describe, it, expect } from "vitest";
import { normaliseDocument } from "../ingestion/normaliseDocument";
import type {
  RawLegalDocument,
  TrustedSource,
} from "../ingestion/types";

const SOURCE: TrustedSource = {
  id: "legislation_gov_uk",
  name: "legislation.gov.uk",
  sourceType: "legislation",
  baseUrl: "https://www.legislation.gov.uk",
  jurisdiction: "uk",
  trustLevel: "primary_statute",
  enabled: true,
};

function rawDoc(over: Partial<RawLegalDocument> = {}): RawLegalDocument {
  return {
    sourceId: SOURCE.id,
    title: "Employment Rights Act 1996 — Section 95",
    canonicalUrl: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    documentType: "statute",
    jurisdiction: "uk",
    rawText: "An employee is dismissed when the contract is terminated.",
    ...over,
  };
}

describe("normaliseDocument", () => {
  it("rejects URL outside source.baseUrl", () => {
    const out = normaliseDocument(
      rawDoc({ canonicalUrl: "https://www.example.com/x" }),
      SOURCE
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("url_out_of_domain");
  });

  it("strips script + style blocks from rawHtml", () => {
    const raw = rawDoc({
      rawText: undefined,
      rawHtml:
        "<html><head><style>body{color:red}</style></head>" +
        "<body><script>alert(1)</script><h1>Section 95</h1><p>An employee is dismissed.</p></body></html>",
    });
    const out = normaliseDocument(raw, SOURCE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.document.cleanText).not.toMatch(/<script/i);
    expect(out.document.cleanText).not.toMatch(/<style/i);
    expect(out.document.cleanText).not.toMatch(/alert\(/);
    expect(out.document.cleanText).toMatch(/Section 95/);
    expect(out.document.cleanText).toMatch(/An employee is dismissed\./);
  });

  it("produces a deterministic content hash (same input → same hash)", () => {
    const a = normaliseDocument(rawDoc(), SOURCE);
    const b = normaliseDocument(rawDoc(), SOURCE);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.document.contentHash).toEqual(b.document.contentHash);
  });

  it("produces a different hash when clean text differs", () => {
    const a = normaliseDocument(rawDoc(), SOURCE);
    const b = normaliseDocument(
      rawDoc({ rawText: "An employee is dismissed when the contract ends." }),
      SOURCE
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.document.contentHash).not.toEqual(b.document.contentHash);
  });

  it("rejects empty content", () => {
    const out = normaliseDocument(rawDoc({ rawText: "", rawHtml: "" }), SOURCE);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("empty_content");
  });

  it("rejects credential URLs in canonicalUrl", () => {
    const out = normaliseDocument(
      rawDoc({ canonicalUrl: "https://u:p@www.legislation.gov.uk/x" }),
      SOURCE
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("credentials");
  });
});
