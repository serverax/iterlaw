import { createHash } from "node:crypto";

export function wasmLinearMemoryCeilingBytes(mb: number): number {
  if (mb <= 0 || !Number.isFinite(mb)) {
    throw new Error("mb must be positive finite");
  }
  return Math.floor(mb * 1024 * 1024);
}

/** Deterministic digest for signed WASM proof payloads (no I/O). */
export function proofDigestHex(moduleId: string, version: string, payloadUtf8: string): string {
  return createHash("sha256").update(`${moduleId}|${version}|`, "utf8").update(payloadUtf8, "utf8").digest("hex");
}

/** Simple linear gas cost estimate for typed byte length. */
export function wasmGasEstimate(byteLength: number, costPerByte = 1): number {
  return Math.max(0, Math.ceil(byteLength * costPerByte));
}
