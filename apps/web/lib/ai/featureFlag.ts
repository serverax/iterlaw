// IterLaw web-side AI fallback feature flag.
//
// Default: OFF. External LLM providers (Anthropic / Gemini / other) cannot be
// invoked from the IterLaw web answer path unless an operator explicitly sets
// the env var ITERLAW_WEB_AI_FALLBACK_ENABLED to "true" or "1".
//
// Why this exists (Sprint 12B truth-and-answer-path reconciliation):
//   The IterLaw documented invariant is "no external LLM in the legal answer
//   path". `apps/legal-orchestrator` enforces this at runtime via its transport
//   deny policy. The older `apps/web/lib/ai/{claude,gemini,orchestrate}.ts`
//   path bypassed that policy by calling provider APIs directly. This flag
//   closes that gap: by default, no external provider call leaves the process.
//
// Refusal contract:
//   - Direct provider clients (askClaudeSonnet / askGeminiFlash) throw a
//     descriptive Error before any network call when the flag is OFF.
//   - The fallback orchestrator (callAIFallback) returns null when the flag is
//     OFF, which the upstream answer orchestrator already treats as
//     "AI unavailable" → escalate.
//
// No secret value is read here. The flag is a non-secret runtime toggle.

export const ITERLAW_WEB_AI_FALLBACK_FLAG_ENV = 'ITERLAW_WEB_AI_FALLBACK_ENABLED';

/** Minimal env read surface: avoids requiring full `ProcessEnv` (e.g. `NODE_ENV`) in unit tests. */
export type WebAiFallbackEnv = Record<string, string | undefined>;

export function isWebAiFallbackEnabled(env: WebAiFallbackEnv = process.env): boolean {
  const raw = (env[ITERLAW_WEB_AI_FALLBACK_FLAG_ENV] ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

export const WEB_AI_FALLBACK_DISABLED_MESSAGE =
  `IterLaw web AI fallback is disabled by default. ` +
  `Set ${ITERLAW_WEB_AI_FALLBACK_FLAG_ENV}=true to enable it for a non-production environment ` +
  `under explicit operator authorisation. The legal answer path must not bypass the ` +
  `apps/legal-orchestrator transport deny policy.`;
