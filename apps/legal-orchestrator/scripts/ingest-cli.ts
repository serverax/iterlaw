#!/usr/bin/env npx tsx
/**
 * Legal ingestion CLI — Sprint 7 skeleton.
 *
 * Defaults are safe: dry-run (no HTTP, no DB) unless --live is passed.
 *
 * Examples:
 *   npm run ingest:dry-run
 *   npm run ingest:source -- --source legislation --limit 5
 *   INGESTION_AUDIT=memory npm run ingest:source -- --source acas --limit 2 --live
 */
import { runIngestionCliMain } from "../src/ingestion/cliRunner";

runIngestionCliMain(process.argv.slice(2)).catch((err) => {
  process.stderr.write(String(err instanceof Error ? err.message : err) + "\n");
  process.exit(1);
});
