// Sprint 14 — Intelligence Gateway. Pure orchestrator that wires
// classifier → planner → hybrid retrieval → trust scoring →
// freshness filtering → context compression → semantic cache key
// → rag evaluation → IntelligenceResult.
//
// NO real DB / network / LLM. The hybrid input candidates are
// supplied by the caller (test or future RAG adapter). This makes
// the layer mock-safe and deterministic.

import type {
  CompressedEvidenceBlock,
  HybridRetrievalResult,
  IntelligenceDecisionTrace,
  IntelligenceRequest,
  IntelligenceResult,
  RagEvaluationResult,
  RetrievalCandidate,
  SemanticCacheKey,
  TrustScore,
} from "./intelligence.types";
import { classifyQuery } from "./queryClassifier";
import { planRetrieval } from "./retrievalPlanner";
import { hybridRetrieve } from "./hybridRetriever";
import { scoreCandidates } from "./trustScorer";
import { assessFreshness, filterFreshForLegalAnswer } from "./freshnessFilter";
import { compressEvidence } from "./contextCompressor";
import { buildCacheKey } from "./semanticCache";
import { evaluateRag } from "./ragEvaluator";

export interface GatewayInputs {
  request: IntelligenceRequest;
  keyword_ranked: RetrievalCandidate[];
  vector_ranked: RetrievalCandidate[];
  model_used?: string | null;
  // Optional answer-claim list for citation-coverage evaluation.
  answer_legal_claims?: Array<{ claim_id: string; cited_source_ids: string[] }>;
  // Optional knobs.
  max_evidence_chars?: number;
  allow_historical?: boolean;
  request_id?: string;
}

export function runIntelligenceGateway(input: GatewayInputs): IntelligenceResult {
  const { request, keyword_ranked, vector_ranked } = input;

  // 1. classify intent
  const { intent, reason_codes: intentReasons } = classifyQuery(request.question);

  // 2. plan retrieval
  const plan = planRetrieval(intent);

  // 3. hybrid retrieve (RRF)
  const hybrid: HybridRetrievalResult = hybridRetrieve({
    keyword_ranked,
    vector_ranked,
  });

  // 4. trust score
  const trust: TrustScore[] = scoreCandidates(hybrid.candidates, request);

  // 5. freshness assessment
  const freshness = assessFreshness(hybrid.candidates, {
    allow_historical: input.allow_historical,
  });

  // 6. filter stale legal sources for legal answers
  const isLegal = request.legal_mode === true;
  const filtered = isLegal
    ? filterFreshForLegalAnswer(hybrid.candidates, freshness)
    : { kept: hybrid.candidates, removed: [], reason_codes: ["non_legal_mode_no_legal_filter"] };

  // 7. compress evidence (only for kept candidates)
  const trustById = new Map(trust.map((t) => [t.candidate_id, t]));
  const freshnessById = new Map(freshness.map((f) => [f.candidate_id, f]));
  const compressed: CompressedEvidenceBlock[] = filtered.kept
    .map((c) => {
      const t = trustById.get(c.candidate_id);
      const f = freshnessById.get(c.candidate_id);
      if (!t || !f) return null;
      return compressEvidence(c, t, f, { max_evidence_chars: input.max_evidence_chars });
    })
    .filter((b): b is CompressedEvidenceBlock => b !== null);

  // 8. semantic cache key
  const cache_key: SemanticCacheKey = buildCacheKey({
    request,
    evidence: compressed,
    model_used: input.model_used ?? null,
  });

  // 9. evaluate
  const evaluation: RagEvaluationResult = evaluateRag(compressed, trust, freshness, {
    legal_mode: isLegal,
    answer_legal_claims: input.answer_legal_claims,
  });

  // 10. decision
  let decision: IntelligenceResult["decision"] = "proceed";
  const reason_codes: string[] = [
    `intent:${intent}`,
    ...intentReasons.slice(0, 4),
    ...plan.reason_codes.slice(0, 4),
    ...hybrid.reason_codes.slice(0, 4),
    ...filtered.reason_codes.slice(0, 4),
  ];
  if (compressed.length === 0) {
    decision = "insufficient_sources";
    reason_codes.push("decision:insufficient_sources_no_compressed_evidence");
  } else if (evaluation.block_recommended) {
    decision = "block";
    reason_codes.push("decision:block_by_rag_evaluator");
  } else if (evaluation.needs_review) {
    decision = "needs_review";
    reason_codes.push("decision:needs_review_by_rag_evaluator");
  } else {
    reason_codes.push("decision:proceed");
  }

  const trace: IntelligenceDecisionTrace = {
    request_id: input.request_id ?? "intel-trace",
    intent,
    plan,
    hybrid,
    trust_scores: trust,
    freshness,
    compressed,
    cache_key,
    evaluation,
    reason_codes,
  };

  return {
    decision,
    trace,
    evidence: compressed,
    reason_codes,
  };
}
