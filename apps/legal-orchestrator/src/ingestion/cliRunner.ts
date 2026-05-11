import { IngestionAudit } from "./ingestionAudit";
import { isKnownSourceKey } from "./sourceRegistry";
import { runIngestionPlan } from "./runIngestionPlan";
import type { IngestionSourceKey } from "./types";

export interface ParsedIngestCli {
  dryRun: boolean;
  live: boolean;
  writeChunks: boolean;
  sourceKey?: IngestionSourceKey;
  limit: number;
}

export function parseIngestCliArgs(argv: string[]): ParsedIngestCli {
  let dryRun = false;
  let live = false;
  let writeChunks = false;
  let sourceKey: IngestionSourceKey | undefined;
  let limit = 5;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--live") live = true;
    else if (a === "--write-chunks") writeChunks = true;
    else if (a === "--source") {
      const v = argv[++i];
      if (!v) throw new Error("--source requires a value");
      if (!isKnownSourceKey(v)) throw new Error(`unknown --source ${v}`);
      sourceKey = v;
    } else if (a === "--limit") {
      const v = argv[++i];
      const n = v ? parseInt(v, 10) : NaN;
      if (!Number.isFinite(n) || n < 1) throw new Error("--limit must be a positive integer");
      limit = Math.min(n, 500);
    }
  }

  if (live) dryRun = false;
  else dryRun = true;

  return { dryRun, live, writeChunks, sourceKey, limit };
}

export async function runIngestionCliMain(argv: string[]): Promise<void> {
  const parsed = parseIngestCliArgs(argv);
  const audit = IngestionAudit.fromEnv();

  const result = await runIngestionPlan({
    sourceKey: parsed.sourceKey,
    limit: parsed.limit,
    dryRun: parsed.dryRun,
    live: parsed.live,
    writeChunks: parsed.writeChunks,
    audit,
  });

  const summary = {
    mode: result.dryRun ? "dry-run" : "live",
    live: result.live,
    writeChunks: result.writeChunks,
    auditEnabled: result.auditEnabled,
    plannedUrls: result.items.map((i) => i.entry.canonicalUrl),
    fetched: result.items.filter((i) => i.fetch).length,
    errors: result.items.filter((i) => i.fetch && !i.fetch.ok).map((i) => ({
      url: i.entry.canonicalUrl,
      err: i.fetch?.error,
    })),
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}
