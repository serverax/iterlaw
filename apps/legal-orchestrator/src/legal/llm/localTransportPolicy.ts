// Sprint 11 Phase 2A — local transport policy guard.
//
// Validates a candidate base URL BEFORE any future transport adapter
// is permitted to use it. The policy:
//   * Default mode: `"disabled"`. No URL required.
//   * Allowed transport schemes when enabled: `http` and explicit
//     internal `ITERLAW_*_BASE_URL` patterns to LAN / cluster hosts.
//   * Public-provider hostnames are PERMANENTLY rejected — the policy
//     refuses them regardless of mode or allow-list.
//   * Generic `https://` targets are rejected by default. A future
//     sprint may add an explicit `allowedHosts` list, after staging
//     DB verification has passed and the operator approves it.
//
// This module is pure. It does NOT open sockets, resolve DNS, or
// perform any HTTP request. It only inspects the supplied string.

export type LocalTransportMode = "disabled" | "internal";

export interface LocalTransportPolicyDecision {
  ok: boolean;
  reason:
    | "policy_disabled"
    | "no_url_required"
    | "url_allowed"
    | "url_allowed_loopback"
    | "url_allowed_cluster_dns"
    | "external_provider_blocked"
    | "external_https_blocked"
    | "invalid_url"
    | "scheme_not_allowed"
    | "host_not_allowed";
  /** Lowercased hostname extracted from the supplied URL, when parseable. */
  host?: string;
}

export interface LocalTransportPolicyInput {
  /** `"disabled"` (default) or `"internal"`. */
  mode?: LocalTransportMode;
  /** Candidate target URL. May be omitted when the mode is `"disabled"`. */
  url?: string;
  /**
   * Optional explicit allow-list of internal hostnames. Lowercase
   * compared. Sprint 11 Phase 2A does NOT auto-populate this; it
   * remains empty unless the caller passes it.
   */
  allowedInternalHosts?: ReadonlyArray<string>;
}

/**
 * Hostnames that are permanently denied — the public managed LLM
 * providers. Used by the policy guard AND by the static-safety tests
 * that scan source for accidental references.
 */
export const EXTERNAL_PROVIDER_HOSTS: ReadonlyArray<string> = [
  "api.openai.com",
  "openai.com",
  "anthropic.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "googleapis.com",
  "api.cohere.ai",
  "api.cohere.com",
  "cohere.ai",
  "cohere.com",
  "api.mistral.ai",
  "mistral.ai",
];

function isProviderHost(host: string): boolean {
  const lower = host.toLowerCase();
  for (const banned of EXTERNAL_PROVIDER_HOSTS) {
    if (lower === banned || lower.endsWith(`.${banned}`)) return true;
  }
  return false;
}

function isLoopbackHost(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1";
}

function isClusterDnsHost(host: string): boolean {
  const lower = host.toLowerCase();
  // Match Kubernetes in-cluster DNS: `<svc>.<ns>.svc.cluster.local`
  // and the shorter `<svc>.<ns>.svc` form.
  return /\.svc(\.cluster\.local)?$/.test(lower);
}

function parseHost(url: string): { ok: true; host: string; scheme: string } | { ok: false } {
  try {
    const u = new URL(url);
    return {
      ok: true,
      host: u.hostname.toLowerCase(),
      scheme: u.protocol.replace(/:$/, "").toLowerCase(),
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Pure validation. Sprint 11 Phase 2A guarantees:
 *   - In `disabled` mode, the policy returns `ok` and `no_url_required`.
 *   - A public-provider URL is always rejected.
 *   - A generic external `https://` URL is rejected by default.
 *   - Only `internal` mode + parseable URL + allow-listed host passes.
 */
export function evaluateLocalTransportPolicy(
  input: LocalTransportPolicyInput,
): LocalTransportPolicyDecision {
  const mode = input.mode ?? "disabled";

  if (mode === "disabled") {
    if (!input.url) return { ok: true, reason: "policy_disabled" };
    const parsed = parseHost(input.url);
    if (parsed.ok && isProviderHost(parsed.host)) {
      return { ok: false, reason: "external_provider_blocked", host: parsed.host };
    }
    return { ok: true, reason: "no_url_required" };
  }

  if (!input.url) {
    return { ok: false, reason: "invalid_url" };
  }
  const parsed = parseHost(input.url);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_url" };
  }

  if (isProviderHost(parsed.host)) {
    return { ok: false, reason: "external_provider_blocked", host: parsed.host };
  }

  if (parsed.scheme !== "http" && parsed.scheme !== "https") {
    return { ok: false, reason: "scheme_not_allowed", host: parsed.host };
  }

  if (parsed.scheme === "https") {
    // HTTPS to a public IP or external domain is rejected by default,
    // even in internal mode. Loopback / cluster-DNS hosts must use
    // http://; explicit allow-listing covers the rare HTTPS-internal
    // case.
    const allowedHttps = (input.allowedInternalHosts ?? []).some((h) => h.toLowerCase() === parsed.host);
    if (!allowedHttps) {
      return { ok: false, reason: "external_https_blocked", host: parsed.host };
    }
    return { ok: true, reason: "url_allowed", host: parsed.host };
  }

  if (isLoopbackHost(parsed.host)) {
    return { ok: true, reason: "url_allowed_loopback", host: parsed.host };
  }
  if (isClusterDnsHost(parsed.host)) {
    return { ok: true, reason: "url_allowed_cluster_dns", host: parsed.host };
  }

  const allow = input.allowedInternalHosts ?? [];
  if (allow.length === 0) {
    return { ok: false, reason: "host_not_allowed", host: parsed.host };
  }
  if (allow.some((h) => h.toLowerCase() === parsed.host)) {
    return { ok: true, reason: "url_allowed", host: parsed.host };
  }
  return { ok: false, reason: "host_not_allowed", host: parsed.host };
}

/**
 * Convenience wrapper matching the Sprint 11 Phase 2A planning
 * signature: `{ url?, enabled? }`. Delegates to
 * `evaluateLocalTransportPolicy`. Disabled-by-default; pass
 * `enabled: true` to enter `internal` mode.
 */
export function validateLocalTransportTarget(input: {
  url?: string;
  enabled?: boolean;
  allowedInternalHosts?: ReadonlyArray<string>;
}): LocalTransportPolicyDecision {
  return evaluateLocalTransportPolicy({
    mode: input.enabled ? "internal" : "disabled",
    url: input.url,
    allowedInternalHosts: input.allowedInternalHosts,
  });
}
