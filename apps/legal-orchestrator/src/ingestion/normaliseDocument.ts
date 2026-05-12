// Module-path compatibility shim. Some Sprint 11 tests import the
// British-spelled module path `../ingestion/normaliseDocument`. The
// real implementation lives in `./normalizeDocument` (US spelling).
// Re-export the surface unchanged.

export { normalizeDocument, normaliseDocument } from "./normalizeDocument";
