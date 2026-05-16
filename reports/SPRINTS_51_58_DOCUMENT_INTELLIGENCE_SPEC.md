# Sprints 51–58 — Document Intelligence Band

**Status:** PREP (implementation gated on UAT sign-off)  
**Base branch:** `master` (Sprints 45–50 merged, 3263 tests)  
**Next migration numbers:** 147–154

## Batch 1 — Document processing (51–54)

| Sprint | Focus | Migration | Band (planned) |
|--------|--------|-----------|----------------|
| 51 | Upload + OCR | 147 | `DocumentUploadOcrPhase51Band` |
| 52 | Entity extraction | 148 | `EntityExtractionPhase52Band` |
| 53 | Legal document parsing | 149 | `LegalDocumentParsingPhase53Band` |
| 54 | Classification + metadata | 150 | `DocumentClassificationPhase54Band` |

## Batch 2 — Semantic search & synthesis (55–58)

| Sprint | Focus | Migration | Band (planned) |
|--------|--------|-----------|----------------|
| 55 | Semantic chunking | 151 | `SemanticChunkingPhase55Band` |
| 56 | Vector search | 152 | `SemanticSearchPhase56Band` |
| 57 | Cited answers | 153 | `CitationLockedAnswerPhase57Band` |
| 58 | Integration + validation | 154 | `DocumentIntelIntegrationPhase58Band` |

## Repo alignment notes

- `117_sprints_52_57_document_intel.sql` already defines `document_uploads`, `document_entities`, `document_chunks` (workspace-scoped). Sprints 51–58 migrations **extend** those tables or add companion tables (`document_analysis`, `document_metadata`, `search_sessions`, `cited_answers`).
- `documentIntelBand.ts` holds shared helpers (`documentUploadMimeAllowed`, `chunkCoherenceScore`, etc.).
- Zone 2: `zone2DocumentTypes.ts` + `zone2DocumentStub.ts` (Azure Document Intelligence, embeddings, synthesis stubs).

## Environment (implementation phase)

- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`
- `AZURE_OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `pgvector` extension for Sprint 55+

## Execution gate

Do **not** merge implementation commits until:

1. UAT sign-off
2. Stakeholder start signal
3. Full test suite green per sprint (40–50 tests each)
4. Sprint tags `sprint-51-complete` … `sprint-58-complete`

See product handoff document in chat (2026-05-16) for full API shapes, schemas, and acceptance criteria.
