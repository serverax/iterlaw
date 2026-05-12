// Orchestration entry point. Skeleton-only: no DB, no Ollama, no external LLM.
// Deterministic modules run via `runLegalModulePipeline` after retrieval.
// Default RAG port is empty → usually `insufficient_sources`. When chunks exist
// but no LLM draft, citation verification refuses an empty uncited draft →
// `citation_failed` until the gateway supplies a cited answer.

import type { LegalRequest, LegalResponse, ExtractedFacts, RagChunk } from "../types/legal.js";
import { classifyRequest } from "./classifyRequest.js";
import { immediateRiskCheck } from "./immediateRiskCheck.js";
import { buildLegalPrompt } from "./buildLegalPrompt.js";
import { runLegalModulePipeline } from "../modules/modulePipeline.js";
import type { Jurisdiction, RetrievedChunk } from "../modules/contracts.js";
import { createRagService } from "../rag/rag.service.js";
import type { RetrievalPort, RetrievedLegalChunk } from "../rag/retrieval.port.js";
import { deriveApplicableLegalDate } from "../rag/temporalFilter.js";

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

export async function handleLegalRequest(
  input: LegalRequest,
  deps?: { rag?: RagPort; retrieval?: RetrievalPort }
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

  // When retrieval returned chunks, the skeleton still has no LLM draft — we
  // pass an empty draft so citation/policy gates refuse an uncited answer.
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

function ragChunkToRetrievedChunk(c: RagChunk): RetrievedChunk {
  return {
    chunk_id: c.chunk_id,
    source_type: c.source_type,
    citation_label: c.title,
    chunk_text: c.chunk_text,
    authority_level: c.authority_level,
  };
}
