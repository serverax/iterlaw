// Curated registry of *planned* upstream URLs — no crawling, no discovery.
// Sprint 7 skeleton: fixed rows only. Expand via config-driven JSON later.

import type { IngestionSourceKey, RegistryEntry, TrustedSource } from "./types";

function u(host: string, path: string): { robotsHost: string; robotsPath: string; canonicalUrl: string } {
  const canonicalUrl = `https://${host}${path.startsWith("/") ? path : `/${path}`}`;
  return { robotsHost: host, robotsPath: path.startsWith("/") ? path : `/${path}`, canonicalUrl };
}

const ENTRIES: RegistryEntry[] = (() => {
  const rows: Omit<RegistryEntry, "id">[] = [
    {
      sourceKey: "legislation",
      title: "Employment Rights Act 1996 — contents (legislation.gov.uk)",
      ...u("www.legislation.gov.uk", "/ukpga/1996/18/contents"),
    },
    {
      sourceKey: "legislation",
      title: "Equality Act 2010 — contents (legislation.gov.uk)",
      ...u("www.legislation.gov.uk", "/ukpga/2010/15/contents"),
    },
    {
      sourceKey: "gov_uk_employment",
      title: "Employing people — GOV.UK browse",
      ...u("www.gov.uk", "/browse/employing-people"),
    },
    {
      sourceKey: "gov_uk_employment",
      title: "Holiday entitlement — GOV.UK",
      ...u("www.gov.uk", "/holiday-entitlement-rights"),
    },
    {
      sourceKey: "acas",
      title: "ACAS home",
      ...u("www.acas.org.uk", "/"),
    },
    {
      sourceKey: "acas",
      title: "ACAS — new to employment",
      ...u("www.acas.org.uk", "/new-to-employment"),
    },
    {
      sourceKey: "et_public",
      title: "Employment Tribunal decisions — GOV.UK collection",
      ...u("www.gov.uk", "/government/collections/employment-tribunal-decisions"),
    },
    {
      sourceKey: "cac",
      title: "CAC — certification and procedures (GOV.UK guidance)",
      ...u("www.gov.uk", "/guidance/report-on-cac-certification-and-procedures"),
    },
  ];
  return rows.map((r, i) => ({ ...r, id: `${r.sourceKey}-${i}` }));
})();

export function listAllRegistryEntries(): readonly RegistryEntry[] {
  return ENTRIES;
}

export function listRegistryEntries(filter: {
  sourceKey?: IngestionSourceKey;
  limit?: number;
}): RegistryEntry[] {
  const limit = Math.min(filter.limit ?? 50, getGlobalFetchCap());
  let out = filter.sourceKey ? ENTRIES.filter((e) => e.sourceKey === filter.sourceKey) : [...ENTRIES];
  out = out.slice(0, limit);
  return out;
}

/** Hard cap to prevent accidental mass URL pulls (env override). */
export function getGlobalFetchCap(): number {
  const raw = process.env.INGESTION_MAX_URLS;
  if (!raw) return 50;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : 50;
}

export function isKnownSourceKey(k: string): k is IngestionSourceKey {
  return (
    k === "legislation" ||
    k === "gov_uk_employment" ||
    k === "acas" ||
    k === "et_public" ||
    k === "cac"
  );
}

const TRUSTED_TYPES = new Set<string>([
  "legislation",
  "gov_guidance",
  "acas_guidance",
  "tribunal_case",
  "hmcts",
  "internal_template",
]);

const TRUST_LEVELS = new Set<string>([
  "primary_statute",
  "primary_law",
  "official_guidance",
  "tribunal_authority",
  "secondary_guidance",
]);

export function validateTrustedSource(src: TrustedSource): { ok: true } | { ok: false; code: string } {
  if (!src.enabled) return { ok: false, code: "disabled" };
  if (!TRUSTED_TYPES.has(src.sourceType)) return { ok: false, code: "unknown_source_type" };
  if (!TRUST_LEVELS.has(src.trustLevel)) return { ok: false, code: "unknown_trust_level" };

  let u: URL;
  try {
    u = new URL(src.baseUrl);
  } catch {
    return { ok: false, code: "non_https_base_url" };
  }
  if (u.protocol !== "https:") return { ok: false, code: "non_https_base_url" };
  if (u.username || u.password) return { ok: false, code: "credential_url" };
  const forbidden = ["javascript:", "file:", "data:", "ftp:"];
  if (forbidden.some((p) => src.baseUrl.toLowerCase().startsWith(p))) {
    return { ok: false, code: "forbidden_scheme" };
  }
  return { ok: true };
}

export function assertUrlBelongsToSource(
  url: string,
  src: TrustedSource
): { ok: true } | { ok: false; code: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (u.protocol !== "https:") return { ok: false, code: "invalid_url" };
  if (u.username || u.password) return { ok: false, code: "credentials" };

  if (["javascript:", "file:", "data:", "ftp:"].some((p) => url.toLowerCase().startsWith(p))) {
    return { ok: false, code: "scheme_blocked" };
  }

  let b: URL;
  try {
    b = new URL(src.baseUrl);
  } catch {
    return { ok: false, code: "invalid_url" };
  }

  const normOrigin = (x: URL) => `${x.protocol}//${x.hostname.toLowerCase()}${x.port ? `:${x.port}` : ""}`;
  if (normOrigin(u) !== normOrigin(b)) return { ok: false, code: "out_of_domain" };

  const baseNorm = b.pathname.replace(/\/+$/, "") || "";
  const up = u.pathname;
  if (baseNorm !== "" && !(up === baseNorm || up.startsWith(`${baseNorm}/`))) {
    // Same semantic class as the origin mismatch above: the URL does
    // not belong to this source. Tests assert a single "out_of_domain"
    // code for both origin and path-prefix violations.
    return { ok: false, code: "out_of_domain" };
  }
  return { ok: true };
}
