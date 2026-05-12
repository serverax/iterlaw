// Local LLM gateway — Sprint 11 interface only.
//
// Default mode is "disabled". The gateway NEVER calls an external
// provider and NEVER produces an answer from model memory. Until a
// real local adapter lands in a later sprint, every "available"
// answer is *_UNAVAILABLE.

import type { LlmGatewayMode, LlmGatewayStatus } from "./llmGateway.types";

const VALID_MODES: LlmGatewayMode[] = ["disabled", "ollama", "llama_cpp", "bifrost"];

export function getConfiguredLlmGatewayMode(
  env: NodeJS.ProcessEnv = process.env
): LlmGatewayMode {
  const requested = env.ITERLAW_LLM_GATEWAY_MODE;
  if (!requested) return "disabled";
  if (VALID_MODES.includes(requested as LlmGatewayMode)) {
    return requested as LlmGatewayMode;
  }
  return "disabled";
}

export function describeLocalLlmGateway(
  env: NodeJS.ProcessEnv = process.env
): LlmGatewayStatus {
  const enabled = env.ITERLAW_LOCAL_LLM_ENABLED === "true";
  const mode = getConfiguredLlmGatewayMode(env);

  if (!enabled || mode === "disabled") {
    return {
      configured: false,
      mode: "disabled",
      available: false,
      reason: "DISABLED",
    };
  }

  if (mode === "ollama" && !env.ITERLAW_OLLAMA_BASE_URL) {
    return {
      configured: false,
      mode,
      available: false,
      reason: "CONFIG_MISSING",
    };
  }

  if (mode === "llama_cpp" && !env.ITERLAW_LLAMA_CPP_BASE_URL) {
    return {
      configured: false,
      mode,
      available: false,
      reason: "CONFIG_MISSING",
    };
  }

  if (mode === "bifrost" && !env.ITERLAW_BIFROST_BASE_URL) {
    return {
      configured: false,
      mode,
      available: false,
      reason: "CONFIG_MISSING",
    };
  }

  return {
    configured: true,
    mode,
    available: false,
    reason:
      mode === "ollama"
        ? "OLLAMA_UNAVAILABLE"
        : mode === "llama_cpp"
          ? "LLAMA_CPP_UNAVAILABLE"
          : "BIFROST_UNAVAILABLE",
  };
}
