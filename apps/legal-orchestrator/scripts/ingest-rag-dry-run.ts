#!/usr/bin/env npx tsx
/**
 * RAG ingestion dry-run.
 *
 * Reads a local fixture document, runs the Sprint 11 ingestion path
 * (normaliseDocument → chunkLegalDocument → extractCitations), validates
 * the source-registry entry, and PRINTS what would be inserted into
 * legal_sources / legal_documents / legal_chunks / legal_citations.
 *
 *   * No HTTP. The fixture is read from the local filesystem.
 *   * No database writes. The repository inserts are simulated by a
 *     recording mock client; the SQL strings are formatted for the
 *     operator to inspect.
 *   * Enable real writes only with `--write`. Even with `--write` the
 *     script REFUSES to run unless `INGEST_DRYRUN_LIVE=true` is also
 *     set in the environment — a second-key guard.
 *
 * Usage:
 *   npm run ingest:dry-run
 *   npm run ingest:dry-run -- --fixture db/fixtures/era-1996-s95.md
 *
 * The script targets the FIRST fixture document only; this is a
 * sprint-level smoke test of the wiring, not a batch ingester.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normaliseDocument,
  chunkLegalDocument,
  extractCitations,
  validateTrustedSource,
  assertUrlBelongsToSource,
  type RawLegalDocument,
  type TrustedSource,
} from "../src/ingestion";
import {
  STATUTORY_SOURCES,
  getStatutorySource,
} from "../src/ingestion/statutorySources";

interface CliArgs {
  fixture: string;
  source_id: string;
  live: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let fixture = "db/fixtures/era-1996-s95.md";
  let source_id = "uk-era-1996";
  let live = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture") fixture = argv[++i] ?? fixture;
    else if (a === "--source-id") source_id = argv[++i] ?? source_id;
    else if (a === "--write") live = true;
  }
  return { fixture, source_id, live };
}

function statutoryToTrusted(s: ReturnType<typeof getStatutorySource>): TrustedSource | undefined {
  if (!s) return undefined;
  // Map the registry's trust intent to the validator vocabulary. ACAS,
  // statute, SI, etc. get a band that validateTrustedSource accepts.
  let trustLevel: TrustedSource["trustLevel"];
  switch (s.source_type) {
    case "legislation":
      trustLevel = "primary_statute";
      break;
    case "statutory_instrument":
      trustLevel = "secondary_legislation";
      break;
    case "acas_guidance":
      trustLevel = "authoritative_guidance";
      break;
    case "gov_guidance":
      trustLevel = "authoritative_guidance";
      break;
    case "tribunal_case":
    case "appeal_case":
    case "case_law":
      trustLevel = "tribunal_decision";
      break;
    default:
      trustLevel = "authoritative_guidance";
  }
  return {
    id: s.source_id,
    name: s.source_name,
    sourceType: s.source_type,
    baseUrl: s.expected_domain,
    jurisdiction: s.jurisdiction.toUpperCase(),
    trustLevel,
    enabled: true,
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
  const fixturePath = join(repoRoot, args.fixture);

  process.stdout.write(`ingest:dry-run\n`);
  process.stdout.write(`  fixture     : ${fixturePath}\n`);
  process.stdout.write(`  source_id   : ${args.source_id}\n`);
  process.stdout.write(`  write mode  : ${args.live ? "ATTEMPT_WRITE" : "DRY_RUN"}\n`);

  if (!existsSync(fixturePath)) {
    process.stderr.write(`FAIL: fixture not found at ${fixturePath}\n`);
    return 2;
  }
  const rawText = readFileSync(fixturePath, "utf8");

  const registryEntry = getStatutorySource(args.source_id);
  if (!registryEntry) {
    process.stderr.write(
      `FAIL: source_id '${args.source_id}' is not in the statutory registry. ` +
        `Known ids: ${STATUTORY_SOURCES.map((s) => s.source_id).join(", ")}\n`
    );
    return 2;
  }

  const trusted = statutoryToTrusted(registryEntry);
  if (!trusted) {
    process.stderr.write("FAIL: could not map registry entry to a TrustedSource shape.\n");
    return 2;
  }

  const sourceValidation = validateTrustedSource(trusted);
  if (!sourceValidation.ok) {
    process.stderr.write(
      `FAIL: source validation rejected '${trusted.id}' with code=${sourceValidation.code}\n`
    );
    return 2;
  }

  // The fixture's canonical URL is derived from the registry's official URL.
  const canonicalUrl = registryEntry.official_url;
  const urlCheck = assertUrlBelongsToSource(canonicalUrl, trusted);
  if (!urlCheck.ok) {
    process.stderr.write(
      `FAIL: canonical_url ${canonicalUrl} rejected by domain check (${urlCheck.code})\n`
    );
    return 2;
  }

  const raw: RawLegalDocument = {
    sourceId: trusted.id,
    title: registryEntry.source_name,
    canonicalUrl,
    documentType: registryEntry.source_type,
    jurisdiction: trusted.jurisdiction,
    rawText,
  };

  const norm = normaliseDocument(raw, trusted);
  if (!norm.ok) {
    process.stderr.write(`FAIL: normaliseDocument rejected fixture (${norm.code})\n`);
    return 2;
  }

  const chunks = chunkLegalDocument(norm.document, { maxWords: 200, overlapWords: 20 });
  const citations = extractCitations(norm.document, chunks);

  process.stdout.write("\n--- normalised ---\n");
  process.stdout.write(`title          : ${norm.document.title}\n`);
  process.stdout.write(`canonicalUrl   : ${norm.document.canonicalUrl}\n`);
  process.stdout.write(`documentType   : ${norm.document.documentType}\n`);
  process.stdout.write(`jurisdiction   : ${norm.document.jurisdiction}\n`);
  process.stdout.write(`contentHash    : ${norm.document.contentHash}\n`);
  process.stdout.write(`cleanText len  : ${norm.document.cleanText.length}\n`);

  process.stdout.write("\n--- chunks (would-be legal_chunks rows) ---\n");
  process.stdout.write(`count          : ${chunks.length}\n`);
  for (const c of chunks) {
    process.stdout.write(
      `  [${c.chunkIndex}] words=${c.tokenCount} section=${c.sectionReference ?? "-"} heading_path=${
        c.headingPath.length > 0 ? c.headingPath.join(" > ") : "-"
      }\n`
    );
  }

  process.stdout.write("\n--- citations (would-be legal_citations rows) ---\n");
  process.stdout.write(`count          : ${citations.length}\n`);
  for (const c of citations) {
    process.stdout.write(
      `  ${c.citationType}: ${c.citationText}` +
        (c.statuteTitle ? ` [statute=${c.statuteTitle}]` : "") +
        (c.sectionReference ? ` [section=${c.sectionReference}]` : "") +
        (c.neutralCitation ? ` [neutral=${c.neutralCitation}]` : "") +
        "\n"
    );
  }

  process.stdout.write("\n--- repository plan (no SQL executed) ---\n");
  process.stdout.write(
    `  upsertLegalSource     : 1 row (source_type=${registryEntry.source_type}, citation_label=${
      registryEntry.source_id
    })\n`
  );
  process.stdout.write("  upsertLegalDocument   : 1 row\n");
  process.stdout.write(`  insertLegalChunks     : ${chunks.length} rows\n`);
  process.stdout.write(`  insertLegalCitations  : ${citations.length} rows\n`);

  if (!args.live) {
    process.stdout.write("\nOK: dry-run complete. No database writes. No HTTP. No secrets.\n");
    return 0;
  }

  // `--write` was passed. Demand a second key from the environment so a
  // stray --write flag in a shell history cannot mutate a live DB.
  if (process.env.INGEST_DRYRUN_LIVE !== "true") {
    process.stderr.write(
      "\nREFUSED: --write was passed but INGEST_DRYRUN_LIVE=true is not set in the environment. " +
        "Refusing to attempt any database write. No connection opened.\n"
    );
    return 3;
  }

  process.stderr.write(
    "\nREFUSED: live ingestion is not implemented in this sprint. " +
      "Set up the DbClient wiring (apps/legal-orchestrator/src/rag/ragRepository.ts) and " +
      "remove this guard once the path is reviewed.\n"
  );
  return 3;
}

const exitCode = main();
process.exit(exitCode);
