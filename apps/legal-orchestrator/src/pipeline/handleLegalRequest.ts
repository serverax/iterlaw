// Orchestration entry point.
//
// Behaviour (as of Sprint 11 Phase 4 + Sprint 15 feature-flagged wiring):
//
// - Default retrieval is the in-process `createRagService()` (mock-safe
//   when DATABASE_URL is unset; Postgres-backed when configured).
// - If a caller injects `deps.retrieval`, that overrides the default.
//   If a caller injects `deps.rag`, the legacy RagPort interface is used.
// - If a caller injects `deps.transport` AND retrieval returned >= 1
//   chunk, `runLocalDraftingStep` is invoked behind the local-only
//   transport (no external network). The drafter's output is mapped to
//   a LegalResponse via the mapper at the bottom of this file. Citation
//   verification, zero-citation blocking, immediate-risk checks, and
//   deadline / limitation warnings are ALL still enforced — the LLM
//   cannot bypass any legal-safety gate.
// - If no transport is injected, the pre-Phase-4 skeleton path runs and
//   the module pipeline produces a refusal (typically `citation_failed`
//   or `insufficient_sources`).
// - Sprint 15 wires the Intelligence Layer behind two env vars
//   (`ITERLAW_INTELLIGENCE_LAYER_ENABLED` + `_MODE`). Default off. In
//   shadow / active mode the gateway is invoked for telemetry only; the
//   result is discarded and the public response shape is unchanged.
// - No external LLM call. No `fetch` invocation in this file. Active
//   mode is intentional PARTIAL — see ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md.

import type { LegalRequest, LegalResponse, ExtractedFacts, RagChunk, Citation, SynthesisStatus, SynthesisMode } from "../types/legal.js";
import { classifyRequest } from "./classifyRequest.js";
import { immediateRiskCheck } from "./immediateRiskCheck.js";
import { buildLegalPrompt } from "./buildLegalPrompt.js";
import { runLegalModulePipeline } from "../modules/modulePipeline.js";
import type { Jurisdiction, RetrievedChunk } from "../modules/contracts.js";
import { createRagService } from "../rag/rag.service.js";
import type { RetrievalPort, RetrievedLegalChunk } from "../rag/retrieval.port.js";
import { deriveApplicableLegalDate } from "../rag/temporalFilter.js";
import { runLocalDraftingStep } from "../legal/llm/runLocalDraftingStep.js";
import type { OllamaTransport } from "../legal/llm/llm.types.js";
import type { LlmGatewayStatus, RetrievedLegalChunkForSynthesis, BoundedSynthesisCitation } from "../legal/llm/llmGateway.types.js";
import type { LocalLlmAuditSink } from "../legal/llm/llmAuditSink.js";
import {
  getIntelligenceLayerConfig,
  getLawModuleRoutingConfig,
  getMultiTierRetrievalConfig,
  getApprovedAnswerFastPathConfig,
} from "../config/featureFlags.js";
import { runIntelligenceGateway } from "../intelligence/intelligenceGateway.js";
import { routeLegalRequestToModule } from "../lawModuleEngine/legalModuleRouting.js";
import { runMultiTierRetrievalGateway } from "../retrieval/multiTierRetrievalGateway.js";
import { runApprovedAnswerFastPathGateway } from "../retrieval/approvedAnswerFastPathGateway.js";
import type {
  IntelligenceResult,
  RetrievalCandidate as IntelligenceRetrievalCandidate,
  RetrievalSource as IntelligenceRetrievalSource,
} from "../intelligence/intelligence.types.js";

interface RagPort {
  search(input: { legal_pack: string; query: string; topic: string; jurisdiction: string; limit: number }): Promise<RagChunk[]>;
}

// Default legacy RAG port — returns empty. Retained so any caller that
// previously injected `deps.rag` keeps working. New callers should
// inject `deps.retrieval` instead.
const emptyRag: RagPort = {
  async search() {
    return [];
  },
};

const INTELLIGENCE_KNOWN_SOURCES: IntelligenceRetrievalSource[] = [
  "statutory_source",
  "govuk_guidance",
  "acas_guidance",
  "tribunal_case",
  "project_memory",
  "sprint_report",
  "approved_output",
  "architecture_decision",
  "user_uploaded_document",
  "draft_ai_output",
];

function normaliseIntelligenceSource(raw: string | undefined): IntelligenceRetrievalSource {
  if (raw && (INTELLIGENCE_KNOWN_SOURCES as string[]).includes(raw)) {
    return raw as IntelligenceRetrievalSource;
  }
  if (raw === "legislation" || raw === "statute") return "statutory_source";
  if (raw === "guidance") return "govuk_guidance";
  if (raw === "acas") return "acas_guidance";
  if (raw === "case" || raw === "case_law") return "tribunal_case";
  return "approved_output";
}

function ragChunkToIntelligenceCandidate(c: RagChunk, rank: number): IntelligenceRetrievalCandidate {
  return {
    candidate_id: c.chunk_id,
    source_type: normaliseIntelligenceSource(c.source_type),
    source_id: c.document_id ?? c.chunk_id,
    source_title: c.title ?? null,
    source_url: c.url ?? null,
    text: c.chunk_text ?? "",
    effective_from: null,
    effective_to: null,
    last_verified_at: null,
    superseded_by: null,
    qa_status: "approved",
    authority_level: c.authority_level ?? null,
    keyword_rank: rank,
    vector_rank: rank,
    reason_codes: ["sprint15_shadow_mapping_from_rag_chunk"],
  };
}

function retrievedLegalChunkToRagChunk(c: RetrievedLegalChunk, score = 0): RagChunk {
  return {
    chunk_id: c.chunk_id,
    document_id: c.document_id,
    source_type: c.source_type,
    authority_level: c.authority_level,
    title: c.title ?? c.citation_label ?? c.chunk_id,
    url: c.url ?? "",
    section_reference: c.section_reference,
    paragraph_reference: c.paragraph_reference,
    chunk_text: c.chunk_text,
    score,
  };
}

function factsToModuleRecord(facts: ExtractedFacts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(facts)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v as unknown;
  }
  return out;
}

function mapJurisdictionFromFacts(j?: string): Jurisdiction {
  const jn = (j ?? "").toLowerCase();
  if (jn.includes("scotland")) return "uk_sc";
  if (jn.includes("northern ireland")) return "uk_ni";
  if (jn === "se" || jn.includes("sweden")) return "se";
  return "uk_ew";
}

function extractLegalFactsFromInput(input: LegalRequest): ExtractedFacts {
  const f = (input.facts ?? {}) as Record<string, unknown>;
  const get = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : undefined);
  const getBool = (k: string) => (typeof f[k] === "boolean" ? (f[k] as boolean) : undefined);
  return {
    employment_start_date: get("employment_start_date"),
    employment_end_date: get("employment_end_date"),
    dismissal_date: get("dismissal_date"),
    incident_date: get("incident_date"),
    suspension_date: get("suspension_date"),
    grievance_date: get("grievance_date"),
    appeal_deadline: get("appeal_deadline"),
    acas_started: getBool("acas_started"),
    acas_certificate_date: get("acas_certificate_date"),
    employment_status: get("employment_status"),
    protected_characteristic_mentioned: getBool("protected_characteristic_mentioned"),
    whistleblowing_mentioned: getBool("whistleblowing_mentioned"),
    jurisdiction: get("jurisdiction") ?? "England and Wales",
  };
}

export interface HandleLegalRequestDeps {
  rag?: RagPort;
  retrieval?: RetrievalPort;
  /**
   * Optional local LLM transport. When supplied, the wired Phase 4
   * drafting step runs AFTER retrieval + citation gate + policy gate
   * approve the evidence pack. When omitted, the orchestrator returns
   * the pre-Sprint-11 skeleton response — no drafting attempt is made,
   * no network call is opened.
   */
  transport?: OllamaTransport;
  gateway?: LlmGatewayStatus;
  auditSink?: LocalLlmAuditSink;
  /**
   * Optional override of how drafted-status maps onto LegalResponse.
   * Defaults to the safe mapper defined below.
   */
}

export async function handleLegalRequest(
  input: LegalRequest,
  deps?: HandleLegalRequestDeps
): Promise<LegalResponse> {
  const rag = deps?.rag ?? emptyRag;
  const legalPack = input.legal_pack ?? "uk_employment_england_wales";

  const classification = classifyRequest({ question: input.question, mode: input.mode });
  const facts = extractLegalFactsFromInput(input);
  const risk = immediateRiskCheck({ classification, facts });
  const applicableOn = deriveApplicableLegalDate({
    facts: facts as unknown as Record<string, unknown>,
  }).applicableDate;

  if (risk.status === "needs_more_facts") {
    return {
      request_id: input.request_id,
      status: "needs_more_facts",
      legal_pack: legalPack,
      jurisdiction: classification.jurisdiction,
      answer: `To answer this safely the following facts are required: ${risk.missing_facts.join(", ")}. No legal position has been generated.`,
      risk_level: risk.risk_level,
      confidence_score: 0,
      rag_used: false,
      external_llm_used: false,
      synthesis_status: "not_attempted",
      synthesis_mode: "redis_streams",
      citations: [],
      missing_facts: risk.missing_facts,
      next_steps: ["Provide the missing facts and re-submit the request."],
    };
  }

  if (risk.status === "high_risk_deadline") {
    return {
      request_id: input.request_id,
      status: "high_risk_deadline",
      legal_pack: legalPack,
      jurisdiction: classification.jurisdiction,
      answer: `A statutory limitation appears to be imminent or already past. ${risk.warnings.join(" ")} No substantive answer has been generated; seek immediate qualified legal advice.`,
      risk_level: risk.risk_level,
      confidence_score: 0,
      rag_used: false,
      external_llm_used: false,
      synthesis_status: "not_attempted",
      synthesis_mode: "redis_streams",
      citations: [],
      next_steps: [
        "Contact ACAS for Early Conciliation if not yet started.",
        "Speak to a qualified solicitor about the limitation position.",
      ],
    };
  }

  // Retrieve from the new RetrievalPort if injected; otherwise fall back
  // to the legacy RagPort interface; otherwise build a default mock-safe
  // RagService from env. The result is a unified `chunks: RagChunk[]` plus
  // optional retrieval_notes.
  let chunks: RagChunk[] = [];
  let retrievalNotes: string[] = [];
  const retrievalQuery = {
    legal_pack: legalPack,
    query_text: input.question ?? "",
    topic: classification.area_of_law,
    jurisdiction: classification.jurisdiction,
    limit: 10,
    ...(applicableOn ? { filters: { applicable_on: applicableOn } } : {}),
  };
  if (deps?.retrieval) {
    const r = await deps.retrieval.search(retrievalQuery);
    chunks = r.chunks.map((c) => retrievedLegalChunkToRagChunk(c));
    retrievalNotes = r.retrieval_notes ?? [];
  } else if (deps?.rag) {
    chunks = await rag.search({
      legal_pack: legalPack,
      query: input.question ?? "",
      topic: classification.area_of_law,
      jurisdiction: classification.jurisdiction,
      limit: 10,
    });
  } else {
    // Default: mock-safe service. Returns empty when DATABASE_URL is unset.
    const service = createRagService();
    const r = await service.search(retrievalQuery);
    chunks = r.chunks.map((c) => retrievedLegalChunkToRagChunk(c));
    retrievalNotes = r.retrieval_notes ?? [];
  }

  // -------------------------------------------------------------------
  // Sprint 15 — Intelligence Layer wiring (feature-flagged, fail-closed).
  // Disabled by default. In shadow mode the gateway is invoked for
  // telemetry only; the legacy answer path is unchanged. In active
  // mode the gateway is invoked and its result is discarded for now
  // (intentional PARTIAL ACTIVE WIRING) — until active mode is fully
  // proven, this is a no-op on the response shape too. Any error in
  // the intelligence layer is caught and ignored to keep the legacy
  // path bulletproof.
  // -------------------------------------------------------------------
  let intelligenceShadowResult: IntelligenceResult | null = null;
  const intelConfig = getIntelligenceLayerConfig();
  if (intelConfig.enabled && (intelConfig.mode === "shadow" || intelConfig.mode === "active")) {
    try {
      const cands = chunks.map((c, i) => ragChunkToIntelligenceCandidate(c, i + 1));
      intelligenceShadowResult = runIntelligenceGateway({
        request: {
          workspace_id: input.workspace_id ?? "",
          project_id: legalPack,
          user_id: input.user_id ?? "",
          question: input.question ?? "",
          legal_mode: true,
          latest_event_at: null,
        },
        keyword_ranked: cands,
        vector_ranked: cands,
        request_id: input.request_id,
      });
    } catch {
      // Hard guard — never let the intelligence layer affect the
      // legacy answer path. Even a thrown exception must collapse to
      // "no shadow telemetry captured this turn".
      intelligenceShadowResult = null;
    }
  }
  // The shadow / partial-active result is intentionally NOT placed on
  // the response. Existing /api/legal/ask shape is preserved exactly.
  void intelligenceShadowResult;

  // -------------------------------------------------------------------
  // Sprint 18A — Law module routing (feature-flagged, default OFF).
  // When ITERLAW_LAW_MODULE_ROUTING_ENABLED=true the registry is consulted
  // to confirm the active legal module. UK Employment is the only active
  // module; planned modules return an inactive_module refusal. The result
  // is recorded only as telemetry and does NOT change the public response
  // shape. Any error collapses to "no routing trace this turn".
  // -------------------------------------------------------------------
  const lawModuleRoutingConfig = getLawModuleRoutingConfig();
  let lawModuleRoutingTrace: ReadonlyArray<string> | null = null;
  if (lawModuleRoutingConfig.enabled) {
    try {
      const decision = routeLegalRequestToModule({
        // Default scope (UK_ENGLAND_WALES + employment). The existing
        // LegalRequest type does not carry an explicit moduleId yet; this
        // sprint deliberately uses scope-default to avoid changing the
        // public request shape.
      });
      lawModuleRoutingTrace = decision.decisionTrace;
    } catch {
      lawModuleRoutingTrace = null;
    }
  }
  void lawModuleRoutingTrace;

  // -------------------------------------------------------------------
  // Sprint 19A — Multi-tier retrieval gateway (feature-flagged, default OFF).
  // Shadow telemetry only: with no injected adapters the gateway returns an
  // empty result and records the decision trace. Behaviour is unchanged.
  // -------------------------------------------------------------------
  const multiTierConfig = getMultiTierRetrievalConfig();
  let multiTierShadowTrace: ReadonlyArray<string> | null = null;
  if (multiTierConfig.enabled) {
    try {
      const gatewayResult = await runMultiTierRetrievalGateway({
        question: input.question ?? "",
        queryType: "legal_question",
      });
      multiTierShadowTrace = gatewayResult.decisionTrace;
    } catch {
      multiTierShadowTrace = null;
    }
  }
  void multiTierShadowTrace;

  // -------------------------------------------------------------------
  // Sprint 27 — Approved-answer fast path (feature-flagged, default OFF).
  // Shadow telemetry only: without an injected `lookup` the gateway records
  // `no_lookup_configured` and returns. Even on a hit, the legacy answer
  // path is not bypassed in this sprint — citation gates remain authoritative.
  // -------------------------------------------------------------------
  const approvedFastPathConfig = getApprovedAnswerFastPathConfig();
  let approvedFastPathShadowTrace: ReadonlyArray<string> | null = null;
  if (approvedFastPathConfig.enabled) {
    try {
      const fpResult = await runApprovedAnswerFastPathGateway({
        workspaceId: input.workspace_id ?? "ws-default",
        projectId: input.case_id ?? "case-default",
        moduleId: "uk_employment",
        jurisdiction: "UK_ENGLAND_WALES",
        lawArea: "employment",
        question: input.question ?? "",
        contextSourceHash: "ctx:default",
        nowIsoDate: new Date().toISOString().slice(0, 10),
      });
      approvedFastPathShadowTrace = fpResult.decisionTrace;
    } catch {
      approvedFastPathShadowTrace = null;
    }
  }
  void approvedFastPathShadowTrace;

  // Build the prompt so the verification layer can audit it. The
  // orchestrator does NOT select or call a model — model selection
  // belongs to synthesis-worker, reached over Redis Streams.
  const prompt = buildLegalPrompt({
    question: input.question ?? "",
    classification,
    facts,
    risk,
    chunks,
  });
  void prompt;

  const moduleJurisdiction: Jurisdiction =
    legalPack === "se_employment" ? "se" : mapJurisdictionFromFacts(facts.jurisdiction);

  const retrievedChunks = chunks.map(ragChunkToRetrievedChunk);

  // Phase 4 path — if a transport is injected, defer the module pipeline
  // until AFTER the drafter produces a draft + citations. The empty-draft
  // skeleton path below is the no-transport back-compat behaviour: it
  // intentionally fails the citation gate because there is no draft to
  // validate.
  if (deps?.transport && chunks.length > 0) {
    const gateway: LlmGatewayStatus =
      deps.gateway ?? { configured: true, mode: "ollama", available: true };
    const drafted = await runLocalDraftingStep(
      {
        question: input.question ?? "",
        facts: factsToModuleRecord(facts),
        retrievedChunks: chunks.map(ragChunkToSynthChunk),
      },
      gateway,
      {
        transport: deps.transport,
        auditSink: deps.auditSink,
        requestId: input.request_id,
        traceId: input.request_id,
      },
    );
    return mapDrafterOutputToLegalResponse({
      input,
      classification,
      legalPack,
      risk,
      drafted,
      sourceChunks: chunks,
    });
  }

  // No transport injected — run the module pipeline with the empty
  // skeleton draft. This is the pre-Sprint-11 path.
  const draftForModules = chunks.length > 0 ? "" : undefined;
  const modulePipelineOut = runLegalModulePipeline({
    userQuestion: input.question ?? "",
    draftAnswer: draftForModules,
    retrievedChunks,
    declaredCitations: [],
    legalPackId: legalPack,
    classification: {
      area_of_law: classification.area_of_law,
      requires_deadline_check: classification.requires_deadline_check,
    },
    facts: factsToModuleRecord(facts),
    jurisdiction: moduleJurisdiction,
  });

  if (chunks.length === 0) {
    return {
      request_id: input.request_id,
      status: "insufficient_sources",
      legal_pack: legalPack,
      jurisdiction: classification.jurisdiction,
      answer:
        "No supporting legal sources are available for this question in the current knowledge base. No legal answer has been generated.",
      risk_level: risk.risk_level,
      confidence_score: 0,
      rag_used: true,
      external_llm_used: false,
      synthesis_status: "not_attempted",
      synthesis_mode: "redis_streams",
      citations: [],
      next_steps: [
        ...(applicableOn ? ["temporal_filter:applied", `date=${applicableOn}`] : []),
        "Ingest the relevant statute / ACAS guidance / case law into the legal knowledge base.",
        "Re-submit once the source corpus contains at least one relevant chunk.",
        ...modulePipelineOut.warnings,
        ...retrievalNotes.map((n) => `retrieval:${n}`),
      ],
    };
  }

  if (!modulePipelineOut.finalAllowed) {
    const isCitation = modulePipelineOut.blockedReasons.some((r) => r.startsWith("citation:"));
    const status: LegalResponse["status"] = isCitation ? "citation_failed" : "policy_failed";
    return {
      request_id: input.request_id,
      status,
      legal_pack: legalPack,
      jurisdiction: classification.jurisdiction,
      answer:
        status === "citation_failed"
          ? "The generated answer did not pass citation verification. No legal answer is being returned."
          : `Policy gate rejected the draft answer: ${modulePipelineOut.policyStatus.failures.join(", ")}.`,
      risk_level: risk.risk_level,
      confidence_score: 0,
      rag_used: true,
      external_llm_used: false,
      synthesis_status: "not_attempted",
      synthesis_mode: "redis_streams",
      citations: [],
      next_steps: ["Operator review required.", ...modulePipelineOut.blockedReasons],
    };
  }

  // No transport injected — preserve the pre-Sprint-11 skeleton response
  // for callers that haven't opted into Phase 4 wiring.
  return {
    request_id: input.request_id,
    status: "safe_answer",
    legal_pack: legalPack,
    jurisdiction: classification.jurisdiction,
    answer: "(skeleton: real LLM call not wired)",
    risk_level: risk.risk_level,
    confidence_score: 0.5,
    rag_used: true,
    external_llm_used: false,
    synthesis_status: "not_attempted",
    synthesis_mode: "redis_streams",
    citations: [],
    next_steps: [],
  };
}

function ragChunkToSynthChunk(c: RagChunk): RetrievedLegalChunkForSynthesis {
  return {
    chunkId: c.chunk_id,
    documentId: c.document_id,
    title: c.title,
    url: c.url ?? "",
    citationLabel: c.title,
    text: c.chunk_text,
    authorityLevel: String(c.authority_level),
    sourceType: c.source_type,
  };
}

function synthCitationToCitation(c: BoundedSynthesisCitation, source?: RagChunk): Citation {
  return {
    chunk_id: c.chunkId,
    document_id: c.documentId,
    source_type: source?.source_type ?? "unknown",
    source_title: c.title,
    source_url: c.url,
    section_reference: source?.section_reference,
    paragraph_reference: source?.paragraph_reference,
    authority_level: source?.authority_level ?? 0,
  };
}

function mapDrafterOutputToLegalResponse(args: {
  input: LegalRequest;
  classification: ReturnType<typeof classifyRequest>;
  legalPack: string;
  risk: ReturnType<typeof immediateRiskCheck>;
  drafted: Awaited<ReturnType<typeof runLocalDraftingStep>>;
  sourceChunks: RagChunk[];
}): LegalResponse {
  const { input, classification, legalPack, risk, drafted, sourceChunks } = args;
  const chunkById = new Map<string, RagChunk>();
  for (const c of sourceChunks) chunkById.set(c.chunk_id, c);

  const base = {
    request_id: input.request_id,
    legal_pack: legalPack,
    jurisdiction: classification.jurisdiction,
    risk_level: risk.risk_level,
    rag_used: true,
    external_llm_used: false,
    synthesis_mode: "direct_local" as SynthesisMode,
  };

  switch (drafted.status) {
    case "synthesised":
      return {
        ...base,
        status: "safe_answer",
        answer: drafted.answer ?? "",
        confidence_score: 0.6,
        synthesis_status: "completed" as SynthesisStatus,
        citations: drafted.citations.map((c) => synthCitationToCitation(c, chunkById.get(c.chunkId))),
        next_steps: [],
      };
    case "citation_failed":
      return {
        ...base,
        status: "citation_failed",
        answer:
          "The drafted answer did not pass citation verification. No legal answer is being returned.",
        confidence_score: 0,
        synthesis_status: "error" as SynthesisStatus,
        citations: [],
        next_steps: [
          ...(drafted.safetyNotes ?? []),
          "Operator review required.",
        ],
      };
    case "blocked_by_policy":
      return {
        ...base,
        status: "policy_failed",
        answer:
          "Policy gate rejected the drafted answer. No legal answer is being returned.",
        confidence_score: 0,
        synthesis_status: "error" as SynthesisStatus,
        citations: [],
        next_steps: [
          ...(drafted.safetyNotes ?? []),
          "Operator review required.",
        ],
      };
    case "insufficient_sources":
      return {
        ...base,
        status: "insufficient_sources",
        answer:
          "The drafter could not produce an answer from the supplied sources.",
        confidence_score: 0,
        synthesis_status: "not_attempted" as SynthesisStatus,
        citations: [],
        next_steps: drafted.safetyNotes ?? [],
      };
    case "llm_unavailable":
    default:
      return {
        ...base,
        status: "llm_unavailable",
        answer:
          "The local legal drafting model is currently unavailable. No legal answer has been generated.",
        confidence_score: 0,
        synthesis_status: "unavailable" as SynthesisStatus,
        citations: [],
        next_steps: drafted.safetyNotes ?? [],
      };
  }
}

function ragChunkToRetrievedChunk(c: RagChunk): RetrievedChunk {
  return {
    chunk_id: c.chunk_id,
    source_type: c.source_type,
    citation_label: c.title,
    chunk_text: c.chunk_text,
    authority_level: c.authority_level,
  };
}
