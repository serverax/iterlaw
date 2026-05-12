import { describe, it, expect } from "vitest";
import { handleSynthesisRequest } from "../handler";
import {
  SCHEMA_VERSION,
  isOk,
  type SynthesisRequest,
  type SynthesisResponse,
} from "../types/synthesis.types";

const REQ_ID = "55555555-5555-4555-8555-555555555555";
const CHUNK_ID = "66666666-6666-4666-8666-666666666666";
const DOC_ID = "77777777-7777-4777-8777-777777777777";

function validRequest(): SynthesisRequest {
  return {
    request_id: REQ_ID,
    schema_version: SCHEMA_VERSION,
    submitted_at: "2026-05-12T14:32:00Z",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    area_of_law: "unfair_dismissal",
    applicable_on: "2026-05-12",
    question: "What is the qualifying period?",
    retrieved_chunks: [
      {
        chunk_id: CHUNK_ID,
        document_id: DOC_ID,
        source_type: "legislation",
        authority_level: 100,
        citation_label: "Employment Rights Act 1996 s.108",
        url: "https://www.legislation.gov.uk/ukpga/1996/18/section/108",
        section_reference: "108",
        paragraph_reference: null,
        effective_date: "1996-08-22",
        applicable_to: null,
        chunk_text: "An employee has the right not to be unfairly dismissed.",
      },
    ],
    ranked_source_ids: [],
    declared_citations: [],
  };
}

describe("handleSynthesisRequest — skeleton (no model client)", () => {
  it("returns status='model_error' for a structurally valid request", async () => {
    const response = await handleSynthesisRequest(validRequest());
    expect(response.status).toBe("model_error");
    expect(response.request_id).toBe(REQ_ID);
    if (response.status !== "ok") {
      expect(response.error).toMatch(/skeleton/i);
    }
  });

  it("returns status='malformed' for a request that fails schema validation", async () => {
    const bad = { ...validRequest(), schema_version: "999" } as unknown;
    const response = await handleSynthesisRequest(bad);
    expect(response.status).toBe("malformed");
    if (response.status !== "ok") {
      expect(response.error.length).toBeGreaterThan(0);
    }
  });

  it("returns status='malformed' for entirely non-object input", async () => {
    const response = await handleSynthesisRequest("not an object");
    expect(response.status).toBe("malformed");
  });

  it("preserves the request_id on malformed payloads when present", async () => {
    const bad = { request_id: REQ_ID, schema_version: "bad" };
    const response = await handleSynthesisRequest(bad);
    expect(response.request_id).toBe(REQ_ID);
  });

  it("uses a zero-uuid sentinel when request_id is missing on a malformed payload", async () => {
    const response = await handleSynthesisRequest({ no_id: true });
    expect(response.request_id).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("rejects requests with extra ADR-forbidden fields (user_id) as malformed", async () => {
    const req = { ...validRequest(), user_id: "u-123" } as unknown;
    const response = await handleSynthesisRequest(req);
    expect(response.status).toBe("malformed");
  });

  it("never throws on arbitrary input shapes", async () => {
    const shapes: unknown[] = [null, undefined, 42, true, [], {}];
    for (const shape of shapes) {
      const response = await handleSynthesisRequest(shape);
      expect(response.status).toBe("malformed");
    }
  });

  it("stamps a non-negative latency_ms on the failure response", async () => {
    const response = await handleSynthesisRequest(validRequest());
    expect(response.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("uses the injected dispatch when provided (success path)", async () => {
    const req = validRequest();
    const fakeOk: SynthesisResponse = {
      request_id: req.request_id,
      status: "ok",
      draft: {
        answer_law_section: "ERA 1996 s.108",
        answer_meaning: "Two years' continuous service.",
        answer_action: "Verify service length.",
        declared_citations: [{ chunk_id: CHUNK_ID, section_reference: "108" }],
      },
      model: { name: "test-model", version: "0.0.0" },
      latency_ms: 42,
    };
    const response = await handleSynthesisRequest(req, {
      dispatch: async () => fakeOk,
    });
    expect(isOk(response)).toBe(true);
    expect(response.latency_ms).toBe(42);
  });

  it("rewrites zero latency on failures so observability stays honest", async () => {
    const req = validRequest();
    let t = 1000;
    const response = await handleSynthesisRequest(req, {
      now: () => {
        t += 5;
        return t;
      },
      dispatch: async () => ({
        request_id: req.request_id,
        status: "model_error",
        error: "stub",
        latency_ms: 0,
      }),
    });
    expect(response.latency_ms).toBeGreaterThan(0);
  });

  it("does not rewrite already-stamped latency on failures", async () => {
    const req = validRequest();
    const response = await handleSynthesisRequest(req, {
      dispatch: async () => ({
        request_id: req.request_id,
        status: "timeout",
        error: "exceeded",
        latency_ms: 8001,
      }),
    });
    expect(response.latency_ms).toBe(8001);
  });
});
