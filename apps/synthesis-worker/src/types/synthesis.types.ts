// SynthesisRequest / SynthesisResponse — wire contract between the
// legal-orchestrator and the synthesis-worker.
//
// Source of truth: docs/adr/004-internal-synthesis-worker.md, sections 4.1,
// 4.2, 4.3. Any change to this file must update the ADR in lockstep and
// the schema_version literal below must be bumped.
//
// Forbidden in SynthesisRequest (enforced via .strict()):
//   - user_id, ip, session, history, free_text — see ADR 004 §4.1.
//
// The orchestrator validates SynthesisResponse via citationVerifier +
// policyGate before any cache write; this module performs only structural
// validation, never semantic trust.

import { z } from "zod";

export const SCHEMA_VERSION = "1" as const;

const Uuid = z.string().uuid();

// ISO 8601 RFC 3339 timestamp (Z or +HH:MM offset). Kept permissive for
// downstream parsers; the worker does not perform clock validation.
const Rfc3339 = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    "must be an RFC 3339 timestamp",
  );

// Calendar date in the request (applicable_on, effective_date,
// applicable_to). Time-of-day is intentionally not represented at this
// boundary — the orchestrator's temporalFilter derives this from facts.
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const RetrievedChunkSchema = z
  .object({
    chunk_id: Uuid,
    document_id: Uuid,
    source_type: z.string().min(1),
    authority_level: z.number().int().min(0).max(100),
    citation_label: z.string().min(1),
    url: z.string().url(),
    section_reference: z.string().nullable(),
    paragraph_reference: z.string().nullable(),
    effective_date: IsoDate.nullable(),
    applicable_to: IsoDate.nullable(),
    chunk_text: z.string().min(1),
  })
  .strict();

export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

export const DeclaredCitationSchema = z
  .object({
    chunk_id: Uuid,
    section_reference: z.string().nullable(),
  })
  .strict();

export type DeclaredCitation = z.infer<typeof DeclaredCitationSchema>;

export const SynthesisRequestSchema = z
  .object({
    request_id: Uuid,
    schema_version: z.literal(SCHEMA_VERSION),
    submitted_at: Rfc3339,

    legal_pack: z.string().min(1),
    jurisdiction: z.string().min(1),
    area_of_law: z.string().min(1),
    applicable_on: IsoDate.nullable(),

    question: z.string().min(1),

    retrieved_chunks: z.array(RetrievedChunkSchema).min(1),
    ranked_source_ids: z.array(Uuid),
    declared_citations: z.array(DeclaredCitationSchema),
  })
  .strict();

export type SynthesisRequest = z.infer<typeof SynthesisRequestSchema>;

const DraftSchema = z
  .object({
    answer_law_section: z.string().min(1),
    answer_meaning: z.string().min(1),
    answer_action: z.string().min(1),
    declared_citations: z.array(DeclaredCitationSchema).min(1),
  })
  .strict();

export type SynthesisDraft = z.infer<typeof DraftSchema>;

const ModelInfoSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
  })
  .strict();

export const SynthesisResponseOkSchema = z
  .object({
    request_id: Uuid,
    status: z.literal("ok"),
    draft: DraftSchema,
    model: ModelInfoSchema,
    latency_ms: z.number().int().min(0),
  })
  .strict();

export const SYNTHESIS_FAILURE_STATUSES = [
  "timeout",
  "model_error",
  "refused",
  "malformed",
] as const;

export type SynthesisFailureStatus = (typeof SYNTHESIS_FAILURE_STATUSES)[number];

export const SynthesisResponseFailSchema = z
  .object({
    request_id: Uuid,
    status: z.enum(SYNTHESIS_FAILURE_STATUSES),
    error: z.string().min(1),
    latency_ms: z.number().int().min(0),
  })
  .strict();

export const SynthesisResponseSchema = z.union([
  SynthesisResponseOkSchema,
  SynthesisResponseFailSchema,
]);

export type SynthesisResponse = z.infer<typeof SynthesisResponseSchema>;
export type SynthesisResponseOk = z.infer<typeof SynthesisResponseOkSchema>;
export type SynthesisResponseFail = z.infer<typeof SynthesisResponseFailSchema>;

export function isOk(r: SynthesisResponse): r is SynthesisResponseOk {
  return r.status === "ok";
}
