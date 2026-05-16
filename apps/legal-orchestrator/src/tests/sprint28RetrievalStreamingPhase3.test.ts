import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RetrievalStreamingPhase3Band } from "../coherentSystem/retrievalStreamingPhase3.js";
import { RetrievalOllamaPhase2Band } from "../coherentSystem/retrievalOllamaPhase2.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql124 = readFileSync(join(__dirname, "../../db/migrations/124_sprint28_retrieval_streaming_phase3.sql"), "utf8");

describe("migration 124_sprint28_retrieval_streaming_phase3.sql", () => {
  it("creates retrieval_streaming_response_queue", () => {
    expect(sql124).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_streaming_response_queue/i);
  });
  it("columns id user_id request_id chunk_sequence chunk_text created_at", () => {
    expect(sql124).toMatch(/chunk_sequence/i);
    expect(sql124).toMatch(/chunk_text/i);
    expect(sql124).toMatch(/request_id/i);
  });
  it("unique request_id + chunk_sequence", () => {
    expect(sql124).toMatch(/UNIQUE \(request_id, chunk_sequence\)/i);
  });
  it("indexes user and request and created", () => {
    expect(sql124).toMatch(/idx_retrieval_streaming_user_created/i);
    expect(sql124).toMatch(/idx_retrieval_streaming_request_created/i);
    expect(sql124).toMatch(/idx_retrieval_streaming_created/i);
  });
  it("RLS user-scoped policies", () => {
    expect(sql124).toMatch(/retrieval_streaming_queue_self_select/i);
    expect(sql124).toMatch(/retrieval_streaming_queue_self_insert/i);
    expect(sql124).toMatch(/retrieval_streaming_queue_admin_delete/i);
  });
  it("down drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/124_sprint28_retrieval_streaming_phase3.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_streaming_response_queue/i);
  });
});

describe("Sprint 28 — Zone2RetrievalServiceStub streamOllamaResponseChunked", () => {
  it("splits words with seq", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const chunks = await stub.streamOllamaResponseChunked("hello world");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.seq).toBe(0);
    expect(chunks[1]!.seq).toBe(1);
  });
  it("empty query yields noop chunk", async () => {
    const stub = new Zone2RetrievalServiceStub();
    const chunks = await stub.streamOllamaResponseChunked("   ");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe("[noop]");
  });
});

describe("Sprint 28 — RetrievalStreamingPhase3Band", () => {
  it("streamResponseChunks carries mergedTtlMs from Phase2", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "llama3",
      query: "a b c",
      requestId: "00000000-0000-4000-8000-000000000001",
    });
    expect(out.chunks).toHaveLength(3);
    expect(out.mergedTtlMs).toBeGreaterThan(0);
  });

  it("captureChunkMetadata detects contiguous", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const meta = band.captureChunkMetadata(
      [
        { chunkSequence: 0, chunkText: "x" },
        { chunkSequence: 1, chunkText: "y" },
      ],
      "req-1",
    );
    expect(meta.contiguous).toBe(true);
    expect(meta.sliceCount).toBe(2);
  });

  it("captureChunkMetadata false when gap", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const meta = band.captureChunkMetadata(
      [
        { chunkSequence: 0, chunkText: "x" },
        { chunkSequence: 2, chunkText: "y" },
      ],
      "req-2",
    );
    expect(meta.contiguous).toBe(false);
  });

  it("spy on streamOllamaResponseChunked", async () => {
    const spy = vi.fn(async (q: string) => new Zone2RetrievalServiceStub().streamOllamaResponseChunked(q));
    const zone2 = delegatingZone2Retrieval({
      streamOllamaResponseChunked: spy,
    });
    const band = new RetrievalStreamingPhase3Band(zone2, new RetrievalOllamaPhase2Band(zone2));
    await band.streamResponseChunks({ model: "m", query: "one two", requestId: "00000000-0000-4000-8000-000000000002" });
    expect(spy).toHaveBeenCalledWith("one two");
  });
});

describe("Sprint 28 — retrievalStreamingPhase3Band default export", () => {
  it("streams via index", async () => {
    const { retrievalStreamingPhase3Band } = await import("../coherentSystem/index.js");
    const out = await retrievalStreamingPhase3Band.streamResponseChunks({
      model: "13b",
      query: "alpha beta",
      requestId: "00000000-0000-4000-8000-000000000003",
    });
    expect(out.chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Sprint 28 — chunk ordering grid", () => {
  it.each(["x", "a b", "p q r s"])("query %s", async (q) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "llama3",
      query: q,
      requestId: "00000000-0000-4000-8000-000000000099",
    });
    const meta = band.captureChunkMetadata(out.chunks, "rid");
    expect(meta.sliceCount).toBe(out.chunks.length);
    if (out.chunks.length > 1) {
      expect(meta.contiguous).toBe(true);
    }
  });
});

describe("Sprint 28 — CHECK chunk_sequence non-negative", () => {
  it("sql constraint", () => {
    expect(sql124).toMatch(/CHECK \(chunk_sequence >= 0\)/i);
  });
});

describe("Sprint 28 — single word", () => {
  it("one chunk", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "m",
      query: "solo",
      requestId: "00000000-0000-4000-8000-000000000004",
    });
    expect(out.chunks).toHaveLength(1);
    expect(out.chunks[0]!.chunkText).toBe("solo");
  });
});

describe("Sprint 28 — custom stream chunks", () => {
  it("uses injected stream", async () => {
    const zone2 = delegatingZone2Retrieval({
      async streamOllamaResponseChunked() {
        return [
          { seq: 0, text: "A" },
          { seq: 1, text: "B" },
        ];
      },
    });
    const band = new RetrievalStreamingPhase3Band(zone2, new RetrievalOllamaPhase2Band(zone2));
    const out = await band.streamResponseChunks({
      model: "x",
      query: "ignored",
      requestId: "00000000-0000-4000-8000-000000000005",
    });
    expect(out.chunks[0]!.chunkText).toBe("A");
  });
});

describe("Sprint 28 — merged TTL stable for same model", () => {
  it("two calls same ttl", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const a = await band.streamResponseChunks({
      model: "llama3",
      query: "q",
      requestId: "00000000-0000-4000-8000-000000000006",
    });
    const b = await band.streamResponseChunks({
      model: "llama3",
      query: "q2",
      requestId: "00000000-0000-4000-8000-000000000007",
    });
    expect(a.mergedTtlMs).toBe(b.mergedTtlMs);
  });
});

describe("Sprint 28 — migration RLS enable", () => {
  it("ENABLE ROW LEVEL SECURITY", () => {
    expect(sql124).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 28 — request_id uuid style in tests", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))("iteration %i", async (i) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "m",
      query: `w${i}`,
      requestId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    });
    expect(out.chunks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Sprint 28 — capture empty", () => {
  it("zero slices", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const meta = band.captureChunkMetadata([], "empty");
    expect(meta.sliceCount).toBe(0);
    expect(meta.contiguous).toBe(true);
  });
});

describe("Sprint 28 — stream maps seq to chunkSequence", () => {
  it("preserves order", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "m",
      query: "t u v",
      requestId: "00000000-0000-4000-8000-000000000008",
    });
    expect(out.chunks.map((c) => c.chunkSequence)).toEqual([0, 1, 2]);
  });
});

describe("Sprint 28 — migration FK user_id", () => {
  it("references users", () => {
    expect(sql124).toMatch(/REFERENCES public\.users\(id\)/i);
  });
});

describe("Sprint 28 — noop chunk contiguous", () => {
  it("single noop is contiguous", async () => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "m",
      query: "",
      requestId: "00000000-0000-4000-8000-000000000009",
    });
    expect(band.captureChunkMetadata(out.chunks, "r").contiguous).toBe(true);
  });
});

describe("Sprint 28 — TTL positive on stream bundle", () => {
  it.each(["llama3", "70b", "13b"])("model %s", async (model) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model,
      query: "x",
      requestId: "00000000-0000-4000-8000-000000000010",
    });
    expect(out.mergedTtlMs).toBeGreaterThan(0);
  });
});

describe("Sprint 28 — chunk text non-empty for words", () => {
  it.each(["aa", "bb cc", "dd ee ff"])("q %s", async (q) => {
    const z = new Zone2RetrievalServiceStub();
    const band = new RetrievalStreamingPhase3Band(z, new RetrievalOllamaPhase2Band(z));
    const out = await band.streamResponseChunks({
      model: "m",
      query: q,
      requestId: "00000000-0000-4000-8000-000000000011",
    });
    for (const c of out.chunks) {
      expect(c.chunkText.length).toBeGreaterThan(0);
    }
  });
});
