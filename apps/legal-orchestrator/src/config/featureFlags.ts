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
