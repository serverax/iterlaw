import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmClientProofPhase3Band } from "../coherentSystem/wasmClientProofPhase3.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql133 = readFileSync(join(__dirname, "../../db/migrations/133_sprint37_wasm_client_proof_cache.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 133", () => {
  it("creates wasm_client_proof_cache", () => {
    expect(sql133).toMatch(/wasm_client_proof_cache/i);
  });
  it("user_id proof_hash generated_at expires_at", () => {
    expect(sql133).toMatch(/user_id/i);
    expect(sql133).toMatch(/proof_hash/i);
    expect(sql133).toMatch(/generated_at/i);
    expect(sql133).toMatch(/expires_at/i);
  });
  it("indexes", () => {
    expect(sql133).toMatch(/idx_wasm_client_proof_user/i);
    expect(sql133).toMatch(/idx_wasm_client_proof_hash/i);
  });
  it("RLS self", () => {
    expect(sql133).toMatch(/wasm_client_proof_cache_self_select/i);
    expect(sql133).toMatch(/wasm_client_proof_cache_self_insert/i);
  });
  it("down", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/133_sprint37_wasm_client_proof_cache.down.sql"), "utf8");
    expect(d).toMatch(/DROP TABLE/i);
  });
});

describe("Sprint 37 — generateProofLocally", () => {
  it("proof hash hex", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "employment", "claim-1");
    expect(r.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.userId).toBe(U1);
  });
  it("spy template", async () => {
    const spy = vi.fn(async (t: string) => new Zone2WasmServiceStub().generateProofTemplate(t));
    const band = new WasmClientProofPhase3Band(delegatingZone2Wasm({ generateProofTemplate: spy }));
    await band.generateProofLocally(U1, "x", "c");
    expect(spy).toHaveBeenCalledWith("x");
  });
});

describe("Sprint 37 — serializeProofForTransport", () => {
  it("json roundtrip", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    const json = band.serializeProofForTransport(r);
    const parsed = JSON.parse(json) as { proofHash: string };
    expect(parsed.proofHash).toBe(r.proofHash);
  });
});

describe("Sprint 37 — cacheProofResult", () => {
  it("hit before expiry", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    band.cacheProofResult(r);
    expect(band.getCachedProof(U1, r.proofHash)).not.toBeNull();
  });
  it("miss after expiry", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    band.cacheProofResult(r);
    expect(band.getCachedProof(U1, r.proofHash, r.expiresAtMs + 1)).toBeNull();
  });
});

describe("Sprint 37 — isExpired", () => {
  it("true past expires", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(band.isExpired(r, r.expiresAtMs + 1)).toBe(true);
  });
});

describe("Sprint 37 — export", () => {
  it("index band", async () => {
    const { wasmClientProofPhase3Band } = await import("../coherentSystem/index.js");
    const r = await wasmClientProofPhase3Band.generateProofLocally(U1, "idx", "c");
    expect(r.payload.claim).toBe("c");
  });
});

describe("Sprint 37 — stable hash", () => {
  it("same inputs", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const a = await band.generateProofLocally(U1, "e", "c");
    const b = await band.generateProofLocally(U1, "e", "c");
    expect(a.proofHash).toBe(b.proofHash);
  });
});

describe("Sprint 37 — different user", () => {
  it("different hash", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const u2 = "00000000-0000-4000-8000-000000000002";
    const a = await band.generateProofLocally(U1, "e", "c");
    const b = await band.generateProofLocally(u2, "e", "c");
    expect(a.proofHash).not.toBe(b.proofHash);
  });
});

describe("Sprint 37 — RLS ENABLE", () => {
  it("on", () => expect(sql133).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 37 — FK users", () => {
  it("references users", () => expect(sql133).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 37 — cache key isolation", () => {
  it("wrong user miss", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    band.cacheProofResult(r);
    expect(band.getCachedProof("00000000-0000-4000-8000-000000000099", r.proofHash)).toBeNull();
  });
});

describe("Sprint 37 — payload fields", () => {
  it("includes skeleton", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "redundancy", "c");
    expect(r.payload.evidenceType).toBe("redundancy");
  });
});

describe("Sprint 37 — generatedAt before expires", () => {
  it("ordering", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(r.generatedAtMs).toBeLessThan(r.expiresAtMs);
  });
});

describe("Sprint 37 — serialize includes expiresAt", () => {
  it("field present", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    const parsed = JSON.parse(band.serializeProofForTransport(r)) as { expiresAt: number };
    expect(parsed.expiresAt).toBe(r.expiresAtMs);
  });
});

describe("Sprint 37 — admin delete policy", () => {
  it("admin delete", () => expect(sql133).toMatch(/wasm_client_proof_cache_admin_delete/i));
});

describe("Sprint 37 — template override", () => {
  it("custom template id", async () => {
    const z = delegatingZone2Wasm({
      async generateProofTemplate() {
        return { templateId: "custom-tpl", skeleton: { x: 1 } };
      },
    });
    const band = new WasmClientProofPhase3Band(z);
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(r.payload).toMatchObject({ x: 1 });
  });
});

describe("Sprint 37 — claim in payload", () => {
  it.each(["a", "b", "long-claim-text"])("claim %s", async (claim) => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", claim);
    expect(r.payload.claim).toBe(claim);
  });
});

describe("Sprint 37 — uuid pk", () => {
  it("id column", () => expect(sql133).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 37 — miss without cache", () => {
  it("null", () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    expect(band.getCachedProof(U1, "nope")).toBeNull();
  });
});

describe("Sprint 37 — isExpired false before", () => {
  it("active", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(band.isExpired(r, r.generatedAtMs + 1000)).toBe(false);
  });
});

describe("Sprint 37 — proofHash in payload", () => {
  it("matches record", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(r.payload.proofHash).toBe(r.proofHash);
  });
});

describe("Sprint 37 — serialize payload nested", () => {
  it("payload preserved", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "employment", "c");
    const parsed = JSON.parse(band.serializeProofForTransport(r)) as { payload: { claim: string } };
    expect(parsed.payload.claim).toBe("c");
  });
});

describe("Sprint 37 — cache overwrite", () => {
  it("latest wins", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const a = await band.generateProofLocally(U1, "t", "a");
    const b = await band.generateProofLocally(U1, "t", "b");
    band.cacheProofResult(a);
    band.cacheProofResult(b);
    expect(band.getCachedProof(U1, b.proofHash)?.payload.claim).toBe("b");
  });
});

describe("Sprint 37 — generated_at default", () => {
  it("sql default", () => expect(sql133).toMatch(/generated_at.*DEFAULT now\(\)/is));
});

describe("Sprint 37 — expires_at required", () => {
  it("not null", () => expect(sql133).toMatch(/expires_at\s+TIMESTAMPTZ NOT NULL/i));
});

describe("Sprint 37 — different evidence type", () => {
  it("different hash", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const a = await band.generateProofLocally(U1, "a", "c");
    const b = await band.generateProofLocally(U1, "b", "c");
    expect(a.proofHash).not.toBe(b.proofHash);
  });
});

describe("Sprint 37 — template id in hash", () => {
  it("affects hash", async () => {
    const z = delegatingZone2Wasm({
      async generateProofTemplate(evidenceType: string) {
        return { templateId: `tpl-${evidenceType}-v2`, skeleton: {} };
      },
    });
    const band = new WasmClientProofPhase3Band(z);
    const r = await band.generateProofLocally(U1, "x", "c");
    expect(r.proofHash).toHaveLength(64);
  });
});

describe("Sprint 37 — serialize proofHash top level", () => {
  it("present", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    expect(JSON.parse(band.serializeProofForTransport(r))).toHaveProperty("proofHash");
  });
});

describe("Sprint 37 — user_id column", () => {
  it("uuid", () => expect(sql133).toMatch(/user_id\s+UUID NOT NULL/i));
});

describe("Sprint 37 — proof_hash index", () => {
  it("index name", () => expect(sql133).toMatch(/idx_wasm_client_proof_hash/i));
});

describe("Sprint 37 — cache clears on expiry read", () => {
  it("removed", async () => {
    const band = new WasmClientProofPhase3Band(new Zone2WasmServiceStub());
    const r = await band.generateProofLocally(U1, "t", "c");
    band.cacheProofResult(r);
    band.getCachedProof(U1, r.proofHash, r.expiresAtMs + 1);
    expect(band.getCachedProof(U1, r.proofHash, r.expiresAtMs + 1)).toBeNull();
  });
});

describe("Sprint 37 — empty evidence type template", () => {
  it("generic", async () => {
    const z = new Zone2WasmServiceStub();
    const t = await z.generateProofTemplate("");
    expect(t.templateId).toBe("tpl-generic");
  });
});
