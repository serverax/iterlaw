// modulePipeline — orchestrates the six deterministic modules in the
// order required by the Mother Brain spec. Pure function. No I/O.
//
// Order:
//   1. PII redact (userQuestion, draftAnswer)
//   2. Load legal pack
//   3. Deadline check
//   4. Source rank
//   5. Citation verify  (only if draftAnswer is present)
//   6. Policy gate     (only if draftAnswer is present)
//   7. Aggregate -> ModulePipelineOutput

import { piiRedactor } from "./piiRedactor";
import { deadlineChecker } from "./deadlineChecker";
import { sourceRanker } from "./sourceRanker";
import { citationVerifier } from "./citationVerifier";
import { policyGateModule } from "./policyGate";
import { UK_EMPLOYMENT_CONTEXT } from "./legal-packs/uk_employment";
import { SE_EMPLOYMENT_CONTEXT } from "./legal-packs/se_employment";
import type {
  CitationInput,
  CitationVerifierOutput,
  DeadlineCheckerOutput,
  Jurisdiction,
  LegalPackContext,
  PolicyGateOutput,
  RetrievedChunk,
  SourceRankerOutput,
  SourceRankerResult,
} from "./contracts";

export interface ModulePipelineInput {
  userQuestion: string;
  draftAnswer?: string;
  retrievedChunks?: RetrievedChunk[];
  declaredCitations?: CitationInput[];
  legalPackId?: string;
  classification?: {
    area_of_law: string;
    requires_deadline_check: boolean;
  };
  facts?: Record<string, unknown>;
  jurisdiction?: Jurisdiction;
  /** Optional override for deterministic tests. */
  now_iso?: string;
}

export interface ModulePipelineOutput {
  safeUserText: string;
  safeDraftAnswer?: string;
  legalPackId: string;
  deadlineWarnings: string[];
  rankedSources: (SourceRankerResult & { ranker_score: number })[];
  citationStatus: CitationVerifierOutput;
  policyStatus: PolicyGateOutput;
  finalAllowed: boolean;
  warnings: string[];
  blockedReasons: string[];
  auditTrace: string[];
}

function pickContext(legalPackId?: string): { ctx: LegalPackContext; resolvedId: string } {
  if (legalPackId === "se_employment") {
    return { ctx: SE_EMPLOYMENT_CONTEXT, resolvedId: "se_employment" };
  }
  // Default — uk_employment_england_wales is the canonical id.
  return { ctx: UK_EMPLOYMENT_CONTEXT, resolvedId: "uk_employment_england_wales" };
}

function chunksToRankerResults(chunks: RetrievedChunk[]): SourceRankerResult[] {
  return chunks.map((c) => ({
    chunk_id: c.chunk_id,
    authority_level: c.authority_level,
    source_type: c.source_type,
    title: c.citation_label ?? c.chunk_id,
    chunk_text: c.chunk_text,
  }));
}

const EMPTY_CITATION: CitationVerifierOutput = {
  pass: true,
  failures: [],
  verified_chunk_ids: [],
};

const EMPTY_POLICY: PolicyGateOutput = {
  pass: true,
  blocked_terms: [],
  failures: [],
};

export function runLegalModulePipeline(input: ModulePipelineInput): ModulePipelineOutput {
  const audit: string[] = [];
  // 1. Legal pack (ruleset) — deterministic; required by deadlineChecker / policyGateModule.
  const { ctx, resolvedId } = pickContext(input.legalPackId);
  audit.push(`legal_pack_loaded:${resolvedId}`);

  // 2. PII redaction (user question + optional draft before any downstream use).
  const piiQ = piiRedactor({ text: input.userQuestion });
  audit.push(`pii_redacted_question:${piiQ.redactions.length}`);

  let safeDraftAnswer: string | undefined;
  if (input.draftAnswer !== undefined) {
    const piiA = piiRedactor({ text: input.draftAnswer });
    safeDraftAnswer = piiA.redacted_text;
    audit.push(`pii_redacted_answer:${piiA.redactions.length}`);
  }

  // 3. Deadline check (uses pack ruleset + matter dates when present).
  let deadlineWarnings: string[] = [];
  let deadlineOutcome: DeadlineCheckerOutput | undefined;
  if (input.classification?.area_of_law && input.facts) {
    deadlineOutcome = deadlineChecker(
      {
        jurisdiction: input.jurisdiction ?? "uk_ew",
        area_of_law: input.classification.area_of_law,
        facts: input.facts,
        now_iso: input.now_iso,
      },
      ctx
    );
    deadlineWarnings = deadlineOutcome.warnings;
    audit.push(`deadline_check:${deadlineOutcome.status}`);
  }

  // 4. Source ranking — query uses redacted text only.
  let rankedSources: (SourceRankerResult & { ranker_score: number })[] = [];
  if (input.retrievedChunks && input.retrievedChunks.length > 0) {
    const ranker: SourceRankerOutput = sourceRanker({
      query: piiQ.redacted_text,
      results: chunksToRankerResults(input.retrievedChunks),
    });
    rankedSources = ranker.ranked_results;
    audit.push(`sources_ranked:${rankedSources.length}`);
  }

  // 5. Citation verifier — only when a draft exists; verify redacted draft text.
  let citationStatus: CitationVerifierOutput = EMPTY_CITATION;
  if (input.draftAnswer !== undefined) {
    const answerForCitation = safeDraftAnswer ?? "";
    citationStatus = citationVerifier({
      answer_text: answerForCitation,
      citations: input.declaredCitations ?? [],
      retrieved_chunks: input.retrievedChunks ?? [],
    });
    audit.push(`citation_check:${citationStatus.pass ? "pass" : "fail"}`);
  }

  // 6. Policy gate — redacted draft + deadline outcome from module checker.
  let policyStatus: PolicyGateOutput = EMPTY_POLICY;
  if (input.draftAnswer !== undefined && input.classification) {
    const dc = deadlineOutcome ?? {
      status: "ok",
      risk_level: "low",
      missing_facts: [],
      rule_hits: [],
      warnings: [],
    };
    policyStatus = policyGateModule(
      {
        answer_text: safeDraftAnswer ?? "",
        classification: input.classification,
        risk_check: {
          status: dc.status,
          risk_level: dc.risk_level,
        },
        has_citations: citationStatus.verified_chunk_ids.length > 0,
      },
      ctx
    );
    audit.push(`policy_gate:${policyStatus.pass ? "pass" : "fail"}`);
  }

  // 7. Final aggregation
  const blockedReasons: string[] = [];
  if (input.draftAnswer !== undefined) {
    if (!citationStatus.pass) {
      for (const f of citationStatus.failures) blockedReasons.push(`citation:${f}`);
    }
    if (!policyStatus.pass) {
      for (const f of policyStatus.failures) blockedReasons.push(`policy:${f}`);
    }
  }
  const finalAllowed = blockedReasons.length === 0;
  audit.push(`final:${finalAllowed ? "allowed" : "blocked"}`);

  const warnings: string[] = [...deadlineWarnings];
  if (input.draftAnswer !== undefined) {
    if (!citationStatus.pass) {
      for (const f of citationStatus.failures) warnings.push(`citation:${f}`);
    }
    if (!policyStatus.pass) {
      for (const f of policyStatus.failures) warnings.push(`policy:${f}`);
    }
  }

  return {
    safeUserText: piiQ.redacted_text,
    safeDraftAnswer,
    legalPackId: resolvedId,
    deadlineWarnings,
    rankedSources,
    citationStatus,
    policyStatus,
    finalAllowed,
    warnings,
    blockedReasons,
    auditTrace: audit,
  };
}
