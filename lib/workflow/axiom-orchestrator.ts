/* eslint-disable no-console -- orchestrator trace logs */
import { buildEmploymentLetter } from '@/lib/agents/axiom-employment/document-employment';
import { extractFactsFromDocument } from '@/lib/agents/extraction-engine';
import { buildAxiomTrace } from '@/lib/agents/reasoning-tracer';
import { saveDocuments, saveFacts, saveReasoning } from '@/lib/supabase/client';
import { assertTransition } from '@/lib/workflow/state-machine';
import type { AxiomTrace, CaseState, ExtractPhaseResult, LegalFact, ReasonPhaseResult } from '@/types';

export async function runExtractPhase(input: {
  caseId: string;
  documentText: string;
  currentState: CaseState;
}): Promise<ExtractPhaseResult> {
  if (input.currentState !== 'intake') {
    throw new Error('Extraction requires currentState=intake');
  }

  assertTransition('intake', 'facts_review');
  const { facts, confidence } = extractFactsFromDocument(input.documentText);

  const persisted = await saveFacts(input.caseId, facts);
  if (!persisted.ok && !persisted.skipped) {
    throw new Error(persisted.error ?? 'Failed to persist facts');
  }

  console.info('[axiom-orchestrator] extract complete', { caseId: input.caseId, factCount: facts.length });

  return {
    caseId: input.caseId,
    facts,
    previousState: 'intake',
    nextState: 'facts_review',
    extractionConfidence: confidence,
  };
}

export async function runReasonPhase(input: {
  caseId: string;
  jurisdiction: AxiomTrace['jurisdiction'];
  facts: LegalFact[];
  currentState: CaseState;
}): Promise<ReasonPhaseResult> {
  if (input.currentState !== 'facts_review') {
    throw new Error('Reasoning requires currentState=facts_review');
  }

  const pending = input.facts.some((f) => f.userConfirmed !== true);
  if (pending) {
    throw new Error('All facts must have userConfirmed=true before reasoning');
  }

  assertTransition('facts_review', 'reasoning');
  assertTransition('reasoning', 'drafting');
  assertTransition('drafting', 'complete');

  const trace = buildAxiomTrace(input.caseId, input.facts, input.jurisdiction);
  const document = buildEmploymentLetter(input.caseId, input.facts, trace);

  const pr = await saveReasoning(input.caseId, trace);
  if (!pr.ok && !pr.skipped) throw new Error(pr.error ?? 'Failed to persist reasoning trace');

  const pd = await saveDocuments(input.caseId, document);
  if (!pd.ok && !pd.skipped) throw new Error(pd.error ?? 'Failed to persist document draft');

  console.info('[axiom-orchestrator] reason complete', { caseId: input.caseId, merit: trace.meritScore });

  return {
    caseId: input.caseId,
    trace,
    document,
    previousState: 'facts_review',
    nextState: 'complete',
  };
}
