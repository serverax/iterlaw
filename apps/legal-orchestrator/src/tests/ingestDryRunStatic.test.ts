// Static checks on the dry-run ingestion CLI. Verifies that the script
// cannot accidentally open a database connection or fetch over HTTP.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STATUTORY_SOURCES,
  getStatutorySource,
  listStatutorySources,
} from "../ingestion/statutorySources";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "../../scripts/ingest-rag-dry-run.ts");
const FIXTURE = join(__dirname, "../../db/fixtures/era-1996-s95.md");

describe("ingest-rag-dry-run script — static guarantees", () => {
  it("does not import a Postgres driver, fetch, axios, or LLM client", () => {
    const body = readFileSync(SCRIPT, "utf8");
    const banned = [
      /\bfrom\s+["']pg["']/,
      /\brequire\(\s*["']pg["']/,
      /\bfrom\s+["']node-fetch["']/,
      /\baxios\b/,
      /\bfetch\s*\(/,
      /\bopenai\b/i,
      /\bollama\b/i,
      /\banthropic\b/i,
    ];
    for (const re of banned) {
      expect(body, `unexpected match for ${re}`).not.toMatch(re);
    }
  });

  it("refuses live writes unless the second-key env var is set", () => {
    const body = readFileSync(SCRIPT, "utf8");
    expect(body).toMatch(/INGEST_DRYRUN_LIVE/);
    expect(body).toMatch(/REFUSED/);
  });

  it("ships the fixture file the script defaults to", () => {
    const fixture = readFileSync(FIXTURE, "utf8");
    expect(fixture.length).toBeGreaterThan(100);
    expect(fixture).toMatch(/Employment Rights Act 1996/);
    expect(fixture).toMatch(/Section 95/);
  });
});

describe("statutorySources registry", () => {
  it("contains every UK employment law source the sprint requires", () => {
    const ids = new Set(STATUTORY_SOURCES.map((s) => s.source_id));
    for (const expected of [
      "uk-nmw-nlw",
      "uk-statutory-redundancy-pay",
      "uk-unfair-dismissal-cap",
      "uk-era-1996",
      "uk-eqa-2010",
      "uk-acas-code-disciplinary-grievance",
      "uk-vento-bands",
      "uk-et-rules-2013",
      "uk-cac-decisions",
    ]) {
      expect(ids.has(expected), `missing registry entry: ${expected}`).toBe(true);
    }
  });

  it("rejects any non-https expected_domain", () => {
    for (const s of STATUTORY_SOURCES) {
      expect(s.expected_domain.startsWith("https://"), `${s.source_id}`).toBe(true);
    }
  });

  it("flags citation_required=true for every entry (legal answers must cite)", () => {
    for (const s of STATUTORY_SOURCES) {
      expect(s.citation_required, `${s.source_id}`).toBe(true);
    }
  });

  it("getStatutorySource returns undefined for unknown ids and the row for known", () => {
    expect(getStatutorySource("not-real")).toBeUndefined();
    expect(getStatutorySource("uk-era-1996")?.source_type).toBe("legislation");
  });

  it("listStatutorySources filters by source_type", () => {
    const legs = listStatutorySources({ source_type: "legislation" });
    expect(legs.length).toBeGreaterThan(0);
    for (const l of legs) expect(l.source_type).toBe("legislation");
  });
});
