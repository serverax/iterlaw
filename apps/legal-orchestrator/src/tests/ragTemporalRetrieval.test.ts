// Tests for the temporal filter end-to-end through the retrieval layer:
//   - MockRetrieval applies the applicable_on filter correctly
//   - chunks with no temporal metadata remain eligible
//   - handleLegalRequest derives a date from facts and passes it through
//
// No live DB, no LLM. Pure deterministic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  MockRetrieval,
  type MockCorpusChunk,
} from "../rag/mockRetrieval";
import type { RagService } from "../rag/rag.service";
import { createApp } from "../server";

// ------------------------------------------------------------------
// Synthetic corpus: same statute, different "effective" dates. The
// 2023-era chunk should be the only one in force for a 2023 incident.
// ------------------------------------------------------------------

const CORPUS: MockCorpusChunk[] = [
  {
    chunk_id: "era-old",
    document_id: "era-1996",
    source_type: "legislation",
    chunk_index: 0,
    chunk_text: "Original definition of dismissal applicable before 2026 reform.",
    title: "ERA 1996 (pre-2026) — Section 95",
    citation_label: "ERA 1996 s.95 (pre-2026)",
    authority_level: 100,
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    effective_date: "1996-08-22",
    applicable_to: "2026-03-31",
    topics: ["unfair_dismissal"],
  },
  {
    chunk_id: "era-new",
    document_id: "era-1996",
    source_type: "legislation",
    chunk_index: 1,
    chunk_text: "Updated definition of dismissal applicable from April 2026.",
    title: "ERA 1996 (2026 amended) — Section 95",
    citation_label: "ERA 1996 s.95 (2026)",
    authority_level: 100,
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    effective_date: "2026-04-01",
    topics: ["unfair_dismissal"],
  },
  {
    chunk_id: "guidance-undated",
    document_id: "acas-procedure",
    source_type: "acas_guidance",
    chunk_index: 0,
    chunk_text:
      "ACAS guidance on dismissal procedure with no recorded effective date — applies regardless of when the dismissal occurred.",
    title: "ACAS Code on Dismissal (timeless excerpt)",
    citation_label: "ACAS Code (dismissal)",
    authority_level: 60,
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    topics: ["unfair_dismissal", "disciplinary"],
    // intentionally no effective_date / applicable_to — must remain eligible
  },
];

describe("MockRetrieval — applicable_on filter", () => {
  it("no applicable_on -> returns all matching chunks (back-compat)", async () => {
    const port = new MockRetrieval({ corpus: CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
    });
    const ids = r.chunks.map((c) => c.chunk_id).sort();
    expect(ids).toEqual(["era-new", "era-old", "guidance-undated"]);
  });

  it("excludes a 2026-effective chunk for a 2023 incident", async () => {
    const port = new MockRetrieval({ corpus: CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
      filters: { applicable_on: "2023-06-01" },
    });
    const ids = r.chunks.map((c) => c.chunk_id).sort();
    expect(ids).not.toContain("era-new");
    expect(ids).toContain("era-old");
    // Undated chunk must remain eligible — best-effort, never silently dropped.
    expect(ids).toContain("guidance-undated");
  });

  it("keeps the 2026-effective chunk for a 2026-05-01 incident", async () => {
    const port = new MockRetrieval({ corpus: CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
      filters: { applicable_on: "2026-05-01" },
    });
    const ids = r.chunks.map((c) => c.chunk_id).sort();
    expect(ids).toContain("era-new");
    // The pre-2026 chunk has applicable_to=2026-03-31; 2026-05-01 is after,
    // so the pre-2026 chunk must be excluded.
    expect(ids).not.toContain("era-old");
    expect(ids).toContain("guidance-undated");
  });

  it("emits an applicable_on note when the filter is active", async () => {
    const port = new MockRetrieval({ corpus: CORPUS });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "dismissal",
      jurisdiction: "England and Wales",
      limit: 10,
      filters: { applicable_on: "2024-01-01" },
    });
    expect(r.retrieval_notes ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("mock_retrieval:applicable_on=2024-01-01"),
      ])
    );
  });

  it("chunks with no effective_date / applicable_to always survive the filter", async () => {
    const port = new MockRetrieval({
      corpus: [
        // Pure undated chunk
        {
          chunk_id: "undated-only",
          document_id: "doc-x",
          source_type: "internal_template",
          chunk_index: 0,
          chunk_text: "Some timeless internal procedure.",
          authority_level: 30,
          legal_pack: "uk_employment_england_wales",
        },
      ],
    });
    const r = await port.search({
      legal_pack: "uk_employment_england_wales",
      query_text: "timeless",
      limit: 10,
      filters: { applicable_on: "1900-01-01" }, // absurd boundary date
    });
    expect(r.chunks.map((c) => c.chunk_id)).toEqual(["undated-only"]);
  });
});

// ------------------------------------------------------------------
// handleLegalRequest wiring: spy on the injected RagService and verify
// the `filters.applicable_on` derived from facts is passed through.
// ------------------------------------------------------------------

describe("handleLegalRequest — derives + passes applicable_on", () => {
  // Use a "fresh" date so the risk-check short-circuit (limitation imminent
  // / expired) does NOT fire and we actually reach retrieval. 10 days ago
  // is well inside the 75-day "ok" window in immediateRiskCheck.
  function tenDaysAgoIso(): string {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    return d.toISOString().slice(0, 10);
  }

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes filters.applicable_on derived from dismissal_date", async () => {
    const searchSpy = vi.fn(async () => ({ chunks: [], retrieval_notes: [] }));
    const stub: RagService = {
      search: searchSpy,
      describe: () => ({ strategy: "explicit_port", live: true }),
    };
    const app = createApp({ ragService: stub });
    const fresh = tenDaysAgoIso();

    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "tmp-1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can I claim unfair dismissal?",
        facts: { dismissal_date: fresh, incident_date: "2023-01-01" },
      });
    expect(res.status).toBe(200);
    expect(searchSpy).toHaveBeenCalledTimes(1);
    const call = searchSpy.mock.calls[0]?.[0] as {
      filters?: { applicable_on?: string };
    };
    // dismissal_date must win over incident_date per the priority order.
    expect(call.filters?.applicable_on).toBe(fresh);
  });

  it("omits filters when no usable date in facts", async () => {
    const searchSpy = vi.fn(async () => ({ chunks: [], retrieval_notes: [] }));
    const stub: RagService = {
      search: searchSpy,
      describe: () => ({ strategy: "explicit_port", live: true }),
    };
    const app = createApp({ ragService: stub });

    // Question that classifies but has no dates in facts: suspension w/ date so
    // immediateRiskCheck doesn't short-circuit to needs_more_facts.
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "tmp-2",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can my employer suspend me?",
        facts: { suspension_date: "2026-05-01" }, // not in the priority order
      });
    expect(res.status).toBe(200);
    expect(searchSpy).toHaveBeenCalledTimes(1);
    const call = searchSpy.mock.calls[0]?.[0] as {
      filters?: { applicable_on?: string };
    };
    // suspension_date is NOT in DATE_FIELD_ORDER, so no derived date → no filter
    expect(call.filters?.applicable_on).toBeUndefined();
  });

  it("surfaces a temporal_filter:applied note in next_steps", async () => {
    const searchSpy = vi.fn(async () => ({
      chunks: [],
      retrieval_notes: ["mock_retrieval:matched=0"],
    }));
    const stub: RagService = {
      search: searchSpy,
      describe: () => ({ strategy: "explicit_port", live: true }),
    };
    const app = createApp({ ragService: stub });
    const fresh = tenDaysAgoIso();

    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "tmp-3",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can I claim unfair dismissal?",
        facts: { dismissal_date: fresh },
      });
    expect(res.status).toBe(200);
    expect(res.body.next_steps).toEqual(
      expect.arrayContaining([
        expect.stringContaining("temporal_filter:applied"),
        expect.stringContaining(`date=${fresh}`),
      ])
    );
  });
});
