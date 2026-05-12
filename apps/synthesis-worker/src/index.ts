// Public surface of @ordinoxai/synthesis-worker.
// Importing modules — the orchestrator may consume the types but should
// never instantiate the handler in-process (per ADR 004 §2, synthesis
// runs in its own pod).

export {
  SCHEMA_VERSION,
  SYNTHESIS_FAILURE_STATUSES,
  SynthesisRequestSchema,
  SynthesisResponseSchema,
  SynthesisResponseOkSchema,
  SynthesisResponseFailSchema,
  RetrievedChunkSchema,
  DeclaredCitationSchema,
  isOk,
} from "./types/synthesis.types";

export type {
  SynthesisRequest,
  SynthesisResponse,
  SynthesisResponseOk,
  SynthesisResponseFail,
  SynthesisDraft,
  SynthesisFailureStatus,
  RetrievedChunk,
  DeclaredCitation,
} from "./types/synthesis.types";

export {
  REQUEST_STREAM,
  CONSUMER_GROUP,
  RESPONSE_STREAM_PREFIX,
  STREAM_MAXLEN,
  responseStreamFor,
} from "./queue/redisStreams";

export type { QueuePort } from "./queue/redisStreams";

export { handleSynthesisRequest } from "./handler";
export type { HandlerOptions } from "./handler";
