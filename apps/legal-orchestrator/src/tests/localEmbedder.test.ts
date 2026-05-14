import { describe, expect, it } from "vitest";

import {
  computeLocalEmbedding,
  createLocalEmbedderForVectorSearch,
  type LocalEmbedderTransport,
} from "../retrieval/localEmbedder";
import { createPgvectorSearchFromEmbedder } from "../retrieval/pgvectorSearchAdapter";

function makeTransport(returns: ReadonlyArray<number>, opts: { delayMs?: number } = {}): LocalEmbedderTransport {
  return async (_endpoint, _body, options) => {
    if (opts.delayMs && opts.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, opts.delayMs);
        options.signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    return { embedding: returns };
  };
}

describe("computeLocalEmbedding — happy path", () => {
  it("returns embedding from a local endpoint", async () => {
    const out = await computeLocalEmbedding("unfair dismissal", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "nomic-embed-text",
      transport: makeTransport([0.1, 0.2, 0.3]),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(out.telemetry).toContain("embedder:ok:3");
  });

  it("accepts 127.0.0.1 as local", async () => {
    const out = await computeLocalEmbedding("anything", {
      endpoint: "http://127.0.0.1:11434/api/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2]),
    });
    expect(out.ok).toBe(true);
  });

  it("accepts an extra allowlisted host", async () => {
    const out = await computeLocalEmbedding("anything", {
      endpoint: "http://ollama-host:11434/api/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2]),
      allowLocalHosts: ["ollama-host"],
    });
    expect(out.ok).toBe(true);
  });
});

describe("computeLocalEmbedding — refusal contract", () => {
  it("refuses when no transport is supplied", async () => {
    const out = await computeLocalEmbedding("any", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no_transport_configured");
  });

  it("refuses non-local endpoints (no external API call)", async () => {
    const out = await computeLocalEmbedding("any", {
      endpoint: "https://api.openai.com/v1/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2]),
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("embedder_endpoint_not_local");
  });

  it("refuses empty input", async () => {
    const out = await computeLocalEmbedding("", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2]),
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("embedder_empty_input");
  });

  it("refuses empty embedding response", async () => {
    const out = await computeLocalEmbedding("any", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
      transport: makeTransport([]),
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("embedder_failed");
  });

  it("refuses on dimensionality mismatch", async () => {
    const out = await computeLocalEmbedding("any", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2, 0.3]),
      expectedDimensions: 768,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("dimensionality_mismatch");
    expect(out.telemetry).toContain("embedder:dimensionality_expected:768");
    expect(out.telemetry).toContain("embedder:dimensionality_actual:3");
  });

  it("returns embedder_timeout when transport exceeds timeoutMs", async () => {
    const out = await computeLocalEmbedding("any", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
      transport: makeTransport([0.1, 0.2], { delayMs: 200 }),
      timeoutMs: 30,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("embedder_timeout");
  });

  it("returns embedder_failed on transport throw", async () => {
    const failing: LocalEmbedderTransport = async () => {
      throw new Error("transport broke");
    };
    const out = await computeLocalEmbedding("any", {
      endpoint: "http://localhost:11434/api/embeddings",
      model: "any",
      transport: failing,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("embedder_failed");
  });
});

describe("createLocalEmbedderForVectorSearch — bridge to vectorSearch", () => {
  it("works with the Sprint 32 bridge: question → embedding → vectorSearch", async () => {
    const embedder = createLocalEmbedderForVectorSearch({
      endpoint: "http://localhost:11434/api/embeddings",
      model: "nomic-embed-text",
      transport: makeTransport([0.1, 0.2, 0.3]),
    });
    const search = createPgvectorSearchFromEmbedder(
      {
        searchByEmbedding: async () => [
          {
            chunk_id: "vec-1",
            document_id: "doc-1",
            source_type: "legislation",
            chunk_text: "An employee...",
            title: "ERA 1996",
            url: "https://www.legislation.gov.uk/ukpga/1996/18",
            authority_level: 90,
            effective_date: "1996-05-22",
            applicable_to: null,
          },
        ],
      },
      embedder,
    );
    const out = await search("unfair dismissal", { limit: 5 });
    expect(out).toHaveLength(1);
    expect(out[0]?.candidate_id).toBe("vec-1");
  });

  it("when embedder fails, the bridge swallows the throw and returns []", async () => {
    const embedder = createLocalEmbedderForVectorSearch({
      endpoint: "https://api.openai.com/v1/embeddings", // non-local — refused
      model: "any",
      transport: makeTransport([0.1, 0.2]),
    });
    const search = createPgvectorSearchFromEmbedder(
      { searchByEmbedding: async () => [] },
      embedder,
    );
    const out = await search("anything", { limit: 5 });
    expect(out).toEqual([]);
  });
});

describe("computeLocalEmbedding — security guarantees", () => {
  it("never calls an external host even when supplied", async () => {
    let attemptedEndpoint: string | undefined;
    const transport: LocalEmbedderTransport = async (endpoint) => {
      attemptedEndpoint = endpoint;
      return { embedding: [0.1, 0.2] };
    };
    const out = await computeLocalEmbedding("any", {
      endpoint: "https://api.anthropic.com/v1/messages",
      model: "any",
      transport,
    });
    expect(out.ok).toBe(false);
    // The transport was NOT invoked — refusal happened before the call.
    expect(attemptedEndpoint).toBeUndefined();
  });
});
