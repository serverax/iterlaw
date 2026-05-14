// Sprint 15 — feature flag config.
//
// Reads ONLY two environment variables:
//   ITERLAW_INTELLIGENCE_LAYER_ENABLED  (boolean string: "true" / "false")
//   ITERLAW_INTELLIGENCE_LAYER_MODE     (enum: "off" | "shadow" | "active")
//
// Missing or invalid values fail closed to disabled.
// Active mode requires explicit enabled=true AND mode=active.
// No DATABASE_URL read. No DSN read. No secret read.
// No network call. No DB call.

export type IntelligenceLayerMode = "off" | "shadow" | "active";

export interface IntelligenceLayerConfig {
  enabled: boolean;
  mode: IntelligenceLayerMode;
  source: "env";
}

function readEnv(name: string): string | undefined {
  // Defensive: only read process.env; never log it; never look up
  // unrelated env vars.
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  // We intentionally do not return the raw value to any caller; only
  // its parsed boolean / enum form.
  return raw;
}

function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function parseMode(raw: string | undefined): IntelligenceLayerMode {
  if (raw === undefined) return "off";
  const v = raw.trim().toLowerCase();
  if (v === "off" || v === "shadow" || v === "active") return v;
  return "off";
}

export function getIntelligenceLayerConfig(): IntelligenceLayerConfig {
  const enabledRaw = readEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED");
  const modeRaw = readEnv("ITERLAW_INTELLIGENCE_LAYER_MODE");

  const enabledFlag = parseBool(enabledRaw);
  const requestedMode = parseMode(modeRaw);

  // Fail-closed: if not enabled, mode is forced to off regardless of
  // what the operator set.
  if (!enabledFlag) {
    return { enabled: false, mode: "off", source: "env" };
  }

  // Enabled but mode missing / off / invalid: stay off. Operator must
  // explicitly opt into shadow or active.
  if (requestedMode === "off") {
    return { enabled: true, mode: "off", source: "env" };
  }

  // Sanity: active mode never reads secrets or makes external calls
  // here. The gateway implementation enforces that contract; this
  // function only reports what the operator asked for.
  return { enabled: true, mode: requestedMode, source: "env" };
}

export const INTELLIGENCE_LAYER_FLAGS = {
  ITERLAW_INTELLIGENCE_LAYER_ENABLED:
    "Boolean string. Default false. Must be true to enable any non-off mode.",
  ITERLAW_INTELLIGENCE_LAYER_MODE:
    "One of off | shadow | active. Default off. Active mode does not bypass any existing legal safety gate.",
} as const;

// Sprint 18A — Law Module Routing feature flag.
// Reads ONE environment variable:
//   ITERLAW_LAW_MODULE_ROUTING_ENABLED (boolean string: "true"/"1"/"yes"/"on")
// Default OFF. Fails closed.

export interface LawModuleRoutingConfig {
  enabled: boolean;
  source: "env";
}

export function getLawModuleRoutingConfig(): LawModuleRoutingConfig {
  const raw = readEnv("ITERLAW_LAW_MODULE_ROUTING_ENABLED");
  return { enabled: parseBool(raw), source: "env" };
}

export const LAW_MODULE_ROUTING_FLAGS = {
  ITERLAW_LAW_MODULE_ROUTING_ENABLED:
    "Boolean string. Default false. When true, handleLegalRequest consults the law-module registry to confirm the active legal module and records the routing decision in trace. The active module remains UK Employment. Planned modules are refused. No external LLM, no network, no DB.",
} as const;

// Sprint 19A — Multi-tier retrieval feature flag.
// Reads ONE environment variable:
//   ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED (boolean string)
// Default OFF. Fails closed.

export interface MultiTierRetrievalConfig {
  enabled: boolean;
  source: "env";
}

export function getMultiTierRetrievalConfig(): MultiTierRetrievalConfig {
  const raw = readEnv("ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED");
  return { enabled: parseBool(raw), source: "env" };
}

export const MULTI_TIER_RETRIEVAL_FLAGS = {
  ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED:
    "Boolean string. Default false. When true, handleLegalRequest runs the multi-tier retrieval gateway in shadow mode for telemetry only; gateway result is recorded in trace but does not change the public response shape. No external LLM, no network, no DB.",
} as const;

// Sprint 23 — Deterministic reranker feature flag.
// Reads ONE environment variable:
//   ITERLAW_RERANKER_ENABLED (boolean string)
// Default OFF. Fails closed.

export interface RerankerConfig {
  enabled: boolean;
  source: "env";
}

export function getRerankerConfig(): RerankerConfig {
  const raw = readEnv("ITERLAW_RERANKER_ENABLED");
  return { enabled: parseBool(raw), source: "env" };
}

export const RERANKER_FLAGS = {
  ITERLAW_RERANKER_ENABLED:
    "Boolean string. Default false. When true, the multi-tier retrieval pipeline reorders its final candidates using the deterministic reranker (apps/legal-orchestrator/src/retrieval/reranker.ts). No external reranker model, no LLM, no network.",
} as const;
