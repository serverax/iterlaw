import { chunkDocument } from "./chunkDocument";
import { fetchSourceText, resolveIngestionUserAgent } from "./fetchSource";
import { hashDocumentVersion } from "./hashDocumentVersion";
import { normalizeDocument } from "./normalizeDocument";
import { persistIngestionJob, noOpPersistenceSink, type PersistenceSink } from "./persistIngestionJob";
import { listRegistryEntries } from "./sourceRegistry";
import type { IngestionPlanItem, IngestionPlanResult, IngestionSourceKey } from "./types";
import type { IngestionAudit } from "./ingestionAudit";

export interface RunIngestionPlanParams {
  sourceKey?: IngestionSourceKey;
  limit: number;
  /** When false, only plan + audit (no HTTP, no persistence). */
  dryRun: boolean;
  /** When true with dryRun false, perform HTTP fetches. */
  live: boolean;
  /** When true (and not dry-run), persist chunks via sink. */
  writeChunks: boolean;
  audit: IngestionAudit;
  fetchImpl?: typeof fetch;
  sink?: PersistenceSink;
}

export async function runIngestionPlan(params: RunIngestionPlanParams): Promise<IngestionPlanResult> {
  const entries = listRegistryEntries({ sourceKey: params.sourceKey, limit: params.limit });
  const items: IngestionPlanItem[] = entries.map((e) => ({ entry: e }));
  const auditEnabled = params.audit.isEnabled();

  if (auditEnabled) {
    params.audit.record({
      type: "plan",
      sourceKey: params.sourceKey,
      urls: entries.map((e) => e.canonicalUrl),
    });
  }

  const sink = params.sink ?? noOpPersistenceSink;

  if (params.dryRun || !params.live) {
    return {
      dryRun: true,
      live: false,
      writeChunks: false,
      auditEnabled,
      items,
    };
  }

  const ua = resolveIngestionUserAgent();
  for (const item of items) {
    const fr = await fetchSourceText(item.entry.canonicalUrl, item.entry.robotsHost, item.entry.robotsPath, {
      userAgent: ua,
      fetchImpl: params.fetchImpl,
    });
    item.fetch = {
      ok: fr.ok,
      status: fr.status,
      url: item.entry.canonicalUrl,
      body: fr.body,
      error: fr.error,
      attempts: fr.attempts,
    };

    if (!fr.ok) {
      if (auditEnabled) {
        params.audit.record({
          type: "fetch_error",
          url: item.entry.canonicalUrl,
          message: fr.error ?? `http_${fr.status}`,
        });
      }
      continue;
    }

    const normalized = normalizeDocument(item.entry, fr.body);
    item.normalized = normalized;
    const versionHash = hashDocumentVersion(normalized);
    item.versionHash = versionHash;
    const chunks = chunkDocument(normalized);
    item.chunks = chunks;

    const jobId = `ingest-${item.entry.id}`;
    const outcome = await persistIngestionJob(
      { jobId, canonicalUrl: normalized.canonicalUrl, versionHash, chunks },
      { dryRun: false, writeChunks: params.writeChunks },
      sink
    );

    if (auditEnabled) {
      params.audit.record({
        type: "persist_completed",
        jobId,
        chunksWritten: outcome.chunksWritten,
        jobSaved: outcome.jobSaved,
      });
    }
  }

  return {
    dryRun: false,
    live: true,
    writeChunks: params.writeChunks,
    auditEnabled,
    items,
  };
}
