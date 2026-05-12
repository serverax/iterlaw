import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION,
  SynthesisRequestSchema,
  SynthesisResponseOkSchema,
  SynthesisResponseFailSchema,
  SynthesisResponseSchema,
  SYNTHESIS_FAILURE_STATUSES,
  isOk,
  type SynthesisRequest,
  type SynthesisResponse,
} from "../types/synthesis.types";

const REQ_ID = "11111111-1111-4111-8111-111111111111";
const CHUNK_ID = "22222222-2222-4222-8222-222222222222";
const DOC_ID = "33333333-3333-4333-8333-333333333333";
const SRC_ID = "44444444-4444-4444-8444-444444444444";

function validRequest(): unknown {
  return {
    request_id: REQ_ID,
    schema_version: SCHEMA_VERSION,
    submitted_at: "2026-05-12T14:32:00Z",
    legal_pack: "uk_employment_england_wales",
    jurisdiction: "England and Wales",
    area_of_law: "unfair_dismissal",
    applicable_on: "2026-05-12",
    question: "What is the qualifying period for ordinary unfair dismissal?",
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
    ranked_source_ids: [SRC_ID],
    declared_citations: [],
  };
}

describe("SynthesisRequestSchema", () => {
  it("accepts a well-formed request with one chunk and no declared citations", () => {
    const parsed = SynthesisRequestSchema.safeParse(validRequest());
    expect(parsed.success).toBe(true);
  });

  it("pins schema_version to the literal '1'", () => {
    const bad = { ...(validRequest() as Record<string, unknown>), schema_version: "2" };
    const parsed = SynthesisRequestSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown top-level fields (strict mode)", () => {
    const withForbidden = {
      ...(validRequest() as Record<string, unknown>),
      user_id: "a-user",
    };
    const parsed = SynthesisRequestSchema.safeParse(withForbidden);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown fields inside retrieved_chunks (strict mode)", () => {
    const req = validRequest() as { retrieved_chunks: Array<Record<string, unknown>> };
    req.retrieved_chunks[0]!.ip_address = "10.0.0.1";
    const parsed = SynthesisRequestSchema.safeParse(req);
    expect(parsed.success).toBe(false);
  });

  it("rejects empty retrieved_chunks (orchestrator must filter before enqueue)", () => {
    const req = validRequest() as { retrieved_chunks: unknown[] };
    req.retrieved_chunks = [];
    const parsed = SynthesisRequestSchema.safeParse(req);
    expect(parsed.success).toBe(false);
  });

  it("rejects non-RFC3339 submitted_at", () => {
    const req = { ...(validRequest() as Record<string, unknown>), submitted_at: "yesterday" };
    const parsed = SynthesisRequestSchema.safeParse(req);
    expect(parsed.success).toBe(false);
  });

  it("rejects non-ISO applicable_on values", () => {
    const req = { ...(validRequest() as Record<string, unknown>), applicable_on: "12/05/2026" };
    const parsed = SynthesisRequestSchema.safeParse(req);
    expect(parsed.success).toBe(false);
  });

  it("accepts applicable_on === null", () => {
    const req = { ...(validRequest() as Record<string, unknown>), applicable_on: null };
    const parsed = SynthesisRequestSchema.safeParse(req);
    expect(parsed.success).toBe(true);
  });

  it("constrains authority_level to [0, 100]", () => {
    const req = validRequest() as { retrieved_chunks: Array<Record<string, unknown>> };
    req.retrieved_chunks[0]!.authority_level = 200;
    expect(SynthesisRequestSchema.safeParse(req).success).toBe(false);
  });

  it("requires url on every chunk to be a URL", () => {
    const req = validRequest() as { retrieved_chunks: Array<Record<string, unknown>> };
    req.retrieved_chunks[0]!.url = "not-a-url";
    expect(SynthesisRequestSchema.safeParse(req).success).toBe(false);
  });
});

describe("SynthesisResponseOkSchema", () => {
  it("accepts a well-formed ok response", () => {
    const ok: SynthesisResponse = {
      request_id: REQ_ID,
      status: "ok",
      draft: {
        answer_law_section: "ERA 1996 s.108",
        answer_meaning: "Two years' continuous service is required.",
        answer_action: "Confirm length of service before issuing a claim.",
        declared_citations: [{ chunk_id: CHUNK_ID, section_reference: "108" }],
      },
      model: { name: "synth-v1", version: "2026-05-12" },
      latency_ms: 1234,
    };
    expect(SynthesisResponseOkSchema.safeParse(ok).success).toBe(true);
    expect(isOk(ok)).toBe(true);
  });

  it("rejects ok response without at least one declared citation", () => {
    const bad = {
      request_id: REQ_ID,
      status: "ok" as const,
      draft: {
        answer_law_section: "x",
        answer_meaning: "y",
        answer_action: "z",
        declared_citations: [],
      },
      model: { name: "m", version: "v" },
      latency_ms: 100,
    };
    expect(SynthesisResponseOkSchema.safeParse(bad).success).toBe(false);
  });
});

describe("SynthesisResponseFailSchema", () => {
  it("enumerates exactly four failure statuses", () => {
    expect(SYNTHESIS_FAILURE_STATUSES).toEqual([
      "timeout",
      "model_error",
      "refused",
      "malformed",
    ]);
  });

  for (const status of SYNTHESIS_FAILURE_STATUSES) {
    it(`accepts status: ${status}`, () => {
      const r = {
        request_id: REQ_ID,
        status,
        error: "some reason",
        latency_ms: 0,
      };
      expect(SynthesisResponseFailSchema.safeParse(r).success).toBe(true);
    });
  }

  it("rejects unknown failure status", () => {
    const r = { request_id: REQ_ID, status: "kaboom", error: "x", latency_ms: 0 };
    expect(SynthesisResponseFailSchema.safeParse(r).success).toBe(false);
  });

  it("requires a non-empty error string", () => {
    const r = { request_id: REQ_ID, status: "model_error", error: "", latency_ms: 0 };
    expect(SynthesisResponseFailSchema.safeParse(r).success).toBe(false);
  });
});

describe("SynthesisResponseSchema (union)", () => {
  it("parses both ok and fail shapes", () => {
    const ok = {
      request_id: REQ_ID,
      status: "ok" as const,
      draft: {
        answer_law_section: "a",
        answer_meaning: "b",
        answer_action: "c",
        declared_citations: [{ chunk_id: CHUNK_ID, section_reference: null }],
      },
      model: { name: "m", version: "v" },
      latency_ms: 10,
    };
    const fail = {
      request_id: REQ_ID,
      status: "timeout" as const,
      error: "no response within 8000ms",
      latency_ms: 8001,
    };
    expect(SynthesisResponseSchema.safeParse(ok).success).toBe(true);
    expect(SynthesisResponseSchema.safeParse(fail).success).toBe(true);
  });
});

describe("schema hygiene — fields the ADR forbids", () => {
  it.each(["user_id", "ip", "ip_address", "session", "history", "free_text"])(
    "rejects top-level forbidden field: %s",
    (forbidden) => {
      const req = { ...(validRequest() as Record<string, unknown>), [forbidden]: "x" };
      expect(SynthesisRequestSchema.safeParse(req).success).toBe(false);
    },
  );
});

it("SynthesisRequest type compiles with the shape the tests use", () => {
  // Compile-time assertion; runtime is a no-op.
  const _typed: SynthesisRequest = SynthesisRequestSchema.parse(validRequest());
  expect(_typed.request_id).toBe(REQ_ID);
});
