/**
 * Curated UK employment-law source catalogue (Phase 1 — no live scraping).
 */

import type { RagSourceRecord } from "./rag.types";

export const RAG_SOURCE_REGISTRY: RagSourceRecord[] = [
  {
    sourceId: "uk-emp-rights-act-1996",
    title: "Employment Rights Act 1996",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
    jurisdiction: "UK",
    category: "legislation",
    date: "1996-07-22",
    version: "as amended",
  },
  {
    sourceId: "uk-eq-act-2010",
    title: "Equality Act 2010",
    url: "https://www.legislation.gov.uk/ukpga/2010/15/contents",
    jurisdiction: "UK",
    category: "legislation",
    date: "2010-10-01",
    version: "as amended",
  },
  {
    sourceId: "acas-code-2024",
    title: "ACAS Code of Practice on disciplinary and grievance procedures",
    url: "https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures",
    jurisdiction: "EW",
    category: "acas",
    date: "2024-03-11",
    version: "2024",
  },
  {
    sourceId: "gov-uk-dismissal",
    title: "Dismissal: your rights — GOV.UK",
    url: "https://www.gov.uk/dismissal",
    jurisdiction: "EW",
    category: "guidance",
    date: "2015-01-01",
  },
  {
    sourceId: "eat-burchell",
    title: "British Home Stores Ltd v Burchell (EAT) — reasonable investigation principles",
    url: "https://www.bailii.org/cgi-bin/format.cgi?doc=/cases/UKIAT/1979/1979_IAT_230_79.html",
    jurisdiction: "EW",
    category: "appeal-court",
    date: "1978-01-01",
    paragraphRef: "Burchell / reasonable investigation",
  },
  {
    sourceId: "uksc-unfair-dismissal-example",
    title: "UK Supreme Court — employment law headnotes (placeholder registry entry)",
    url: "https://www.supremecourt.uk/decided-cases/",
    jurisdiction: "UK",
    category: "appeal-court",
    date: "2020-01-01",
    paragraphRef: "Illustrative — replace with specific judgment URL when indexed",
  },
  {
    sourceId: "et-open-justice-placeholder",
    title: "Employment Tribunal judgments — Open Justice / gov.uk tribunal decisions (placeholder)",
    url: "https://www.gov.uk/employment-tribunal-decisions",
    jurisdiction: "EW",
    category: "tribunal",
    date: "2024-06-01",
    paragraphRef: "Registry placeholder — ingest specific ET citations later",
  },
];

export function getSourceById(sourceId: string): RagSourceRecord | undefined {
  return RAG_SOURCE_REGISTRY.find((s) => s.sourceId === sourceId);
}
