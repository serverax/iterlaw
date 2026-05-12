// Sprint 11 — end-to-end ingestion pipeline (dry run).
// Pure logic. No DB writes happen even with a mock repository when dryRun=true.

import { describe, it, expect, vi } from "vitest";
import { runIngestionPipeline } from "../ingestion/ingestionPipeline";
import type {
  IngestionRepository,
} from "../ingestion/ingestionPipeline";
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
    title: "ERA 1996 — Section 95",
    canonicalUrl: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    documentType: "statute",
    jurisdiction: "uk",
    rawText:
      "Section 95\n\nAn employee is dismissed when the contract is terminated by the employer. See Equality Act 2010 s. 13. See also [2024] UKSC 1.",
    ...over,
  };
}

describe("runIngestionPipeline — dry run", () => {
  it("returns counts without DB writes by default", async () => {
    const repo: IngestionRepository = {
      upsertDocument: vi.fn(),
      upsertChunks: vi.fn(),
    };
    const r = await runIngestionPipeline(
      { source: SOURCE, documents: [rawDoc(), rawDoc({ title: "EqA 2010 s.13" })] },
      { repository: repo /* dryRun default true */ }
    );
    expect(r.dryRun).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.documentsSeen).toBe(2);
    expect(r.documentsNormalised).toBe(2);
    expect(r.chunksCreated).toBeGreaterThanOrEqual(2);
    expect(r.citationsExtracted).toBeGreaterThan(0);
    // dryRun=true means repo MUST NOT be called.
    expect((repo.upsertDocument as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((repo.upsertChunks as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("rejects an untrusted source (disabled)", async () => {
    const r = await runIngestionPipeline(
      { source: { ...SOURCE, enabled: false }, documents: [rawDoc()] },
      {}
    );
    expect(r.status).toBe("untrusted_source");
    expect(r.documentsNormalised).toBe(0);
    expect(r.errors[0]?.code).toBe("disabled");
  });

  it("rejects a document URL outside source.baseUrl (recorded as a per-document error)", async () => {
    const r = await runIngestionPipeline(
      {
        source: SOURCE,
        documents: [
          rawDoc(),
          rawDoc({ canonicalUrl: "https://www.example.com/somewhere" }),
        ],
      },
      {}
    );
    // First doc OK, second doc rejected → status="partial"
    expect(r.documentsSeen).toBe(2);
    expect(r.documentsNormalised).toBe(1);
    expect(r.status).toBe("partial");
    expect(r.errors.some((e) => e.code === "url_out_of_domain" && e.documentIndex === 1)).toBe(true);
  });

  it("returns structured errors without exposing stack traces or filesystem paths", async () => {
    const r = await runIngestionPipeline(
      {
        source: SOURCE,
        documents: [rawDoc({ rawText: "", rawHtml: "" })],
      },
      {}
    );
    expect(r.status).toBe("partial");
    const e0 = r.errors[0]!;
    expect(e0.code).toBe("empty_content");
    // No stack-trace shape leaked.
    expect(JSON.stringify(e0)).not.toMatch(/at \w+\s*\(/);
    expect(JSON.stringify(e0)).not.toMatch(/node_modules/);
    expect(JSON.stringify(e0)).not.toMatch(/[A-Z]:\\Users/);
  });

  it("returns no_documents when documents array is empty", async () => {
    const r = await runIngestionPipeline({ source: SOURCE, documents: [] }, {});
    expect(r.status).toBe("no_documents");
    expect(r.documentsSeen).toBe(0);
  });

  it("with dryRun=false + mock repo, actually writes via the mock", async () => {
    const upsertDoc = vi.fn();
    const upsertChunks = vi.fn();
    const repo: IngestionRepository = {
      upsertDocument: upsertDoc,
      upsertChunks,
    };
    const r = await runIngestionPipeline(
      { source: SOURCE, documents: [rawDoc()] },
      { dryRun: false, repository: repo }
    );
    expect(r.dryRun).toBe(false);
    expect(r.status).toBe("ok");
    expect(upsertDoc.mock.calls.length).toBe(1);
    expect(upsertChunks.mock.calls.length).toBe(1);
  });
});
