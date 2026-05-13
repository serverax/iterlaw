// Sprint 18A — Law Module Routing adapter.
//
// Thin, pure adapter that resolves the active legal module for a request and
// records a decision trace. Used by `handleLegalRequest` only when the
// `ITERLAW_LAW_MODULE_ROUTING_ENABLED` feature flag is true (default OFF).
//
// Rules:
//   - No external LLM call. No network. No DB. No mutation.
//   - Default module is UK Employment when the request does not name a module.
//   - Planned / inactive modules are refused with `error.kind === "inactive_module"`.
//   - Citation policy is read-only here; it remains enforced downstream.
//   - On flag OFF, this adapter is never invoked; behaviour is unchanged.

import type { LawArea, LawJurisdiction } from "./legalModule.types";
import { legalModuleRegistry } from "./legalModuleRegistry";

export interface LawModuleRoutingRequest {
  /** Optional module id (e.g. "uk_employment"). If absent, default scope is used. */
  readonly moduleId?: string;
  /** Optional jurisdiction. If absent, falls back to UK_ENGLAND_WALES. */
  readonly jurisdiction?: LawJurisdiction;
  /** Optional law area. If absent, falls back to "employment". */
  readonly lawArea?: LawArea;
}

export type LawModuleRoutingDecision =
  | {
      ok: true;
      moduleId: string;
      ragNamespace: string;
      rulesNamespace: string;
      templatesNamespace: string;
      decisionTrace: ReadonlyArray<string>;
    }
  | {
      ok: false;
      error: { kind: "inactive_module" | "unknown_module" | "invalid_lookup_key" | "ambiguous_match"; reason: string };
      decisionTrace: ReadonlyArray<string>;
    };

const DEFAULT_JURISDICTION: LawJurisdiction = "UK_ENGLAND_WALES";
const DEFAULT_LAW_AREA: LawArea = "employment";

export function routeLegalRequestToModule(
  request: LawModuleRoutingRequest = {},
): LawModuleRoutingDecision {
  const trace: string[] = ["law_module_routing:enter"];

  // Prefer explicit moduleId; fallback to (jurisdiction, lawArea).
  let lookup: ReturnType<typeof legalModuleRegistry.requireActiveModule>;
  if (request.moduleId) {
    trace.push(`law_module_routing:lookup_by_id:${request.moduleId}`);
    lookup = legalModuleRegistry.requireActiveModule({ moduleId: request.moduleId });
  } else {
    const jurisdiction = request.jurisdiction ?? DEFAULT_JURISDICTION;
    const lawArea = request.lawArea ?? DEFAULT_LAW_AREA;
    trace.push(`law_module_routing:lookup_by_scope:${jurisdiction}:${lawArea}`);
    lookup = legalModuleRegistry.requireActiveModule({ jurisdiction, lawArea });
  }

  if (!lookup.ok) {
    trace.push(`law_module_routing:refused:${lookup.error.kind}`);
    return {
      ok: false,
      error: lookup.error,
      decisionTrace: trace,
    };
  }

  trace.push(`law_module_routing:active:${lookup.module.moduleId}`);
  trace.push(
    `law_module_routing:citation_required:${lookup.module.citationPolicy.citationRequired}`,
  );
  trace.push(
    `law_module_routing:zero_citation_answer_blocked:${lookup.module.citationPolicy.zeroCitationAnswerBlocked}`,
  );

  return {
    ok: true,
    moduleId: lookup.module.moduleId,
    ragNamespace: lookup.module.ragNamespace,
    rulesNamespace: lookup.module.rulesNamespace,
    templatesNamespace: lookup.module.templatesNamespace,
    decisionTrace: trace,
  };
}
