import { createHash } from "node:crypto";
import type { NormalizedDocument } from "./types";

/** SHA-256 of canonical URL + normalized body for change detection. */
export function hashDocumentVersion(doc: NormalizedDocument): string {
  const h = createHash("sha256");
  h.update(doc.canonicalUrl, "utf8");
  h.update("\n", "utf8");
  h.update(doc.text, "utf8");
  return h.digest("hex");
}
