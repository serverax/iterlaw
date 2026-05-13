# IterLaw GraphRAG — Roadmap

> Status: Roadmap. **No Neo4j install.** **No graph schema added.**
> Sprint 14 ships hybrid (BM25 + pgvector) only. GraphRAG comes after
> Hybrid + Trust + Freshness + Compression + Cache mature.

## 0. Why a graph at all

UK employment law is structurally graph-shaped:

- statutes contain sections,
- sections cross-reference other sections,
- ACAS code maps to procedural fairness in tribunal decisions,
- Vento bands map to injury-to-feelings discrimination compensation,
- tribunal cases reference statutes and prior cases.

Pure vector search picks up semantic neighbourhood but loses the
explicit "Section 94 → Section 95 → Section 98(4)" structural links.
GraphRAG closes that gap by retrieving over relationships rather than
just embeddings.

## 1. Storage choice

**Postgres-only graph tables for the first iteration.** No Neo4j until
operator authorisation is captured under a dedicated ADR.

Reasons to stay in Postgres:

- one fewer infra dependency;
- pgvector already lives there;
- transactional consistency with the existing RAG corpus;
- backup story unchanged (Track A + Track B both cover Postgres).

Trigger to move to Neo4j (or a similar graph engine):

- query patterns that demand `MATCH (s:Section)-[:contains*1..3]->(p:Paragraph)`
  with sub-100ms latency at IterLaw scale,
- relationship density > ~10M edges,
- operator-approved ADR.

## 2. Schema target (deferred — do NOT create migrations now)

```sql
-- legal_entities: any addressable legal concept
CREATE TABLE legal_entities (
  entity_id        UUID PRIMARY KEY,
  entity_type      TEXT NOT NULL,  -- statute|section|paragraph|case|topic|...
  canonical_label  TEXT NOT NULL,
  source_id        TEXT,
  effective_from   DATE,
  effective_to     DATE,
  superseded_by    UUID,
  metadata         JSONB
);

-- legal_relationships: directed, typed edges
CREATE TABLE legal_relationships (
  relationship_id  UUID PRIMARY KEY,
  from_entity      UUID NOT NULL REFERENCES legal_entities(entity_id),
  to_entity        UUID NOT NULL REFERENCES legal_entities(entity_id),
  relation_type    TEXT NOT NULL,   -- contains|relates_to|cited_by|...
  confidence       NUMERIC(4,3),    -- 0..1
  evidence_chunk   UUID,            -- which chunk asserted this edge
  effective_from   DATE,
  effective_to     DATE
);

-- legal_graph_edges: materialised join for fast traversal
CREATE TABLE legal_graph_edges (
  src              UUID NOT NULL,
  dst              UUID NOT NULL,
  hop_count        INT  NOT NULL,
  rel_path         TEXT[] NOT NULL,
  PRIMARY KEY (src, dst, hop_count)
);

-- legal_case_statute_links: explicit case→statute references
CREATE TABLE legal_case_statute_links (
  case_id          UUID NOT NULL,
  statute_id       UUID NOT NULL,
  section_ref      TEXT,
  PRIMARY KEY (case_id, statute_id, section_ref)
);

-- legal_topic_links: topic clustering (used by retrieval planner)
CREATE TABLE legal_topic_links (
  entity_id        UUID NOT NULL,
  topic            TEXT NOT NULL,
  confidence       NUMERIC(4,3),
  PRIMARY KEY (entity_id, topic)
);
```

Indexes:

- BTREE on `(entity_type, canonical_label)`,
- GIST or BTREE on `effective_from / effective_to`,
- BTREE on `(relation_type, from_entity)` and `(relation_type, to_entity)`.

## 3. Example relationships

| From | Relation | To |
| --- | --- | --- |
| Employment Rights Act 1996 | `contains` | Section 94 unfair dismissal |
| Section 95 | `relates_to` | constructive dismissal |
| Section 98(4) | `relates_to` | reasonableness test |
| Vento bands | `applies_to` | injury-to-feelings discrimination compensation |
| ACAS Code | `relevant_to` | disciplinary procedure fairness |
| EAT decision | `cites` | Section 94 |
| EAT decision | `cites_with_distinguishing` | prior EAT decision |

These are the canonical edges Sprint 15+ will produce from the
already-ingested corpus.

## 4. Retrieval-time use

A future intelligence module `graphHopRetriever.ts` will:

1. Map the question to a small set of seed entities via
   intent-aware lookup (e.g. "unfair dismissal" → Section 94 entity).
2. Expand by 1–2 hops along `contains | relates_to | cited_by`.
3. Fetch the chunks attached to the expanded entities.
4. Merge the chunks into the Sprint 14 hybrid retriever's input list
   alongside BM25 and vector results, then run RRF as usual.

The RAG evaluator is unchanged. GraphRAG just changes how candidates
arrive; downstream trust / freshness / compression / evaluation are
re-used.

## 5. Ordering vs. other Intelligence Layer features

Per the Sprint 14 task contract priority order:

1. Hybrid RAG (Sprint 14 — **DONE foundation**)
2. RAG trust scoring (Sprint 14 — **DONE foundation**)
3. Semantic cache (Sprint 14 — **DONE foundation**)
4. Context compressor (Sprint 14 — **DONE foundation**)
5. WASM policy gates (separate doc — deferred)
6. **GraphRAG (this doc — deferred)**
7. Agentic RAG planner (Sprint 14 planner stub exists; richer planner deferred)
8. Multi-agent critic (deferred)
9. Performance learning loop (deferred)
10. MCP/WASM secure tool registry (deferred)

## 6. Out of scope right now

- No Neo4j install.
- No new migrations.
- No new tables.
- No live ingestion pipeline edits.
- No production touch.
