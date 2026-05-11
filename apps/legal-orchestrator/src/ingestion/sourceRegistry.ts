// Curated registry of *planned* upstream URLs — no crawling, no discovery.
// Sprint 7 skeleton: fixed rows only. Expand via config-driven JSON later.

import type { IngestionSourceKey, RegistryEntry } from "./types";

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

/** Hard cap to prevent accidental mass fetch (env override). */
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
