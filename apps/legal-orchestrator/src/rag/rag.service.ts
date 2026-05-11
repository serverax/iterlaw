// rag.service.ts — picks a RetrievalPort based on environment + caller
// preference, and exposes one search method to the orchestrator.
//
// Selection rules:
//   - If `port` is passed in `createRagService({ port })`, it is used.
//   - Else if DATABASE_URL is set (env or constructor), use PostgresRetrieval.
//   - Else use MockRetrieval with an EMPTY corpus (so the orchestrator
//     keeps returning insufficient_sources without crashing).
//
// The service never throws on missing DB — it returns a structured empty
// result with retrieval_notes describing the reason. Callers should
// treat empty results as "no sources available" and proceed to the
// insufficient_sources status path.

import type { RetrievalQuery } from "./rag.types";
import type { RetrievalPort, RetrievalPortResult } from "./retrieval.port";
import { PostgresRetrieval } from "./postgresRetrieval";
import { MockRetrieval } from "./mockRetrieval";

export interface RagServiceConfig {
  /** Override the port entirely (used by tests). */
  port?: RetrievalPort;
  /** Override the database URL (otherwise read from env). */
  databaseUrl?: string;
  /** Hard cap on results. */
  maxResults?: number;
}

export interface RagService {
  search(input: RetrievalQuery): Promise<RetrievalPortResult>;
  /** Cheap introspection for /ready endpoints. */
  describe(): { strategy: "explicit_port" | "postgres" | "empty_mock"; live: boolean };
}

export function createRagService(config?: RagServiceConfig): RagService {
  if (config?.port) {
    const port = config.port;
    return {
      async search(q) {
        return port.search(q);
      },
      describe() {
        return { strategy: "explicit_port", live: true };
      },
    };
  }

  const dbUrl = config?.databaseUrl ?? process.env.DATABASE_URL;
  if (typeof dbUrl === "string" && dbUrl.length > 0) {
    const pg = new PostgresRetrieval({ databaseUrl: dbUrl, maxResults: config?.maxResults });
    return {
      async search(q) {
        return pg.search(q);
      },
      describe() {
        return { strategy: "postgres", live: pg.isLive() };
      },
    };
  }

  const mock = new MockRetrieval({ corpus: [] });
  return {
    async search(q) {
      const r = await mock.search(q);
      const notes = r.retrieval_notes ?? [];
      notes.unshift("rag_service:empty_mock_default");
      return { chunks: r.chunks, retrieval_notes: notes };
    },
    describe() {
      return { strategy: "empty_mock", live: false };
    },
  };
}
