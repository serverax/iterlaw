import { createHash } from "node:crypto";

/** Canonical SHA-256 prefix (40 hex chars) over sorted JSON entries of inputs. */
export function lawModuleInputFingerprint(inputs: Record<string, unknown>): string {
  const keys = Object.keys(inputs).sort();
  const canonical = JSON.stringify(keys.map((k) => [k, inputs[k]]));
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 40);
}
