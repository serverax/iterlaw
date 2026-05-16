import { createHash } from "node:crypto";

const PEPPER = "iterlaw_member_api_v1";

/** One-way hash for persisting API keys (raw key never stored). */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(`${PEPPER}:${rawKey}`, "utf8").digest("hex");
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const a = hashApiKey(rawKey);
  if (a.length !== storedHash.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
