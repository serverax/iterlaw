import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WasmSignedPackagePhase4Band } from "../coherentSystem/wasmSignedPackagePhase4.js";
import { Zone2WasmServiceStub } from "../coherentSystem/zone2WasmStub.js";
import { delegatingZone2Wasm } from "./helpers/zone2WasmTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql134 = readFileSync(join(__dirname, "../../db/migrations/134_sprint38_wasm_signed_evidence_packages.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 134", () => {
  it("creates wasm_signed_evidence_packages", () => {
    expect(sql134).toMatch(/wasm_signed_evidence_packages/i);
  });
  it("columns", () => {
    expect(sql134).toMatch(/package_hash/i);
    expect(sql134).toMatch(/signature/i);
    expect(sql134).toMatch(/public_key_id/i);
    expect(sql134).toMatch(/signed_at/i);
  });
  it("indexes", () => {
    expect(sql134).toMatch(/idx_wasm_signed_pkg_user/i);
    expect(sql134).toMatch(/idx_wasm_signed_pkg_hash/i);
  });
  it("RLS", () => {
    expect(sql134).toMatch(/wasm_signed_evidence_packages_self_select/i);
    expect(sql134).toMatch(/wasm_signed_evidence_packages_self_insert/i);
  });
  it("down", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/134_sprint38_wasm_signed_evidence_packages.down.sql"), "utf8");
    expect(d).toMatch(/DROP TABLE/i);
  });
});

describe("Sprint 38 — signEvidencePackage", () => {
  it("returns signature", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "payload", "key-1");
    expect(r.signature).toMatch(/^ed25519-stub:/);
    expect(r.userId).toBe(U1);
  });
  it("spy signPackageRemote", async () => {
    const spy = vi.fn(async (h: string, k: string) => new Zone2WasmServiceStub().signPackageRemote(h, k));
    const band = new WasmSignedPackagePhase4Band(delegatingZone2Wasm({ signPackageRemote: spy }));
    await band.signEvidencePackage(U1, "p", "k");
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 38 — verifySignature", () => {
  it("valid when untampered", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "payload", "key-1");
    expect(await band.verifySignature(r)).toBe(true);
  });
});

describe("Sprint 38 — detectTamper", () => {
  it("true when payload changes", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "original", "key-1");
    expect(band.detectTamper(r, "tampered")).toBe(true);
  });
  it("false when same", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const payload = "same";
    const r = await band.signEvidencePackage(U1, payload, "key-1");
    expect(band.detectTamper(r, payload)).toBe(false);
  });
});

describe("Sprint 38 — storeSignedPackage", () => {
  it("retrieve by id", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    band.storeSignedPackage(r);
    expect(band.getStoredPackage(r.id)?.packageHash).toBe(r.packageHash);
  });
});

describe("Sprint 38 — packageHash", () => {
  it("stable", () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    expect(band.packageHash("x")).toBe(band.packageHash("x"));
  });
});

describe("Sprint 38 — export", () => {
  it("index", async () => {
    const { wasmSignedPackagePhase4Band } = await import("../coherentSystem/index.js");
    const r = await wasmSignedPackagePhase4Band.signEvidencePackage(U1, "from-index", "k");
    expect(r.publicKeyId).toBe("k");
  });
});

describe("Sprint 38 — key rotation", () => {
  it("different keys different sig", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const a = await band.signEvidencePackage(U1, "p", "key-a");
    const b = await band.signEvidencePackage(U1, "p", "key-b");
    expect(a.signature).not.toBe(b.signature);
  });
});

describe("Sprint 38 — verify fails wrong sig", () => {
  it("invalid", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    const bad = { ...r, signature: "ed25519-stub:invalid" };
    expect(await band.verifySignature(bad)).toBe(false);
  });
});

describe("Sprint 38 — RLS ENABLE", () => {
  it("on", () => expect(sql134).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 38 — FK users", () => {
  it("users fk", () => expect(sql134).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 38 — signed_at default", () => {
  it("now", () => expect(sql134).toMatch(/signed_at.*DEFAULT now\(\)/is));
});

describe("Sprint 38 — packageHash differs", () => {
  it("payload change", () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    expect(band.packageHash("a")).not.toBe(band.packageHash("b"));
  });
});

describe("Sprint 38 — uuid id", () => {
  it("record id", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 38 — delegating verify false", () => {
  it("override", async () => {
    const z = delegatingZone2Wasm({
      async verifySignatureRemote() {
        return { valid: false };
      },
    });
    const band = new WasmSignedPackagePhase4Band(z);
    const r = await band.signEvidencePackage(U1, "p", "k");
    expect(await band.verifySignature(r)).toBe(false);
  });
});

describe("Sprint 38 — admin delete", () => {
  it("policy", () => expect(sql134).toMatch(/wasm_signed_evidence_packages_admin_delete/i));
});

describe("Sprint 38 — store miss", () => {
  it("null", () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    expect(band.getStoredPackage("00000000-0000-4000-8000-000000000099")).toBeNull();
  });
});

describe("Sprint 38 — COMMENT", () => {
  it("comment", () => expect(sql134).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 38 — public_key_id stored", () => {
  it("key id", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "rot-key-9");
    expect(r.publicKeyId).toBe("rot-key-9");
  });
});

describe("Sprint 38 — hash length", () => {
  it("64 hex", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "payload", "k");
    expect(r.packageHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Sprint 38 — verifySignatureRemote spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (h: string, s: string, k: string) =>
      new Zone2WasmServiceStub().verifySignatureRemote(h, s, k),
    );
    const band = new WasmSignedPackagePhase4Band(delegatingZone2Wasm({ verifySignatureRemote: spy }));
    const r = await band.signEvidencePackage(U1, "p", "k");
    await band.verifySignature(r);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 38 — tamper breaks verify", () => {
  it("flow", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "good", "k");
    expect(band.detectTamper(r, "bad")).toBe(true);
    expect(await band.verifySignature({ ...r, packageHash: band.packageHash("bad") })).toBe(false);
  });
});

describe("Sprint 38 — user scoped insert", () => {
  it("policy insert", () => expect(sql134).toMatch(/self_insert/i));
});

describe("Sprint 38 — signedAtMs number", () => {
  it("timestamp", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const before = Date.now();
    const r = await band.signEvidencePackage(U1, "p", "k");
    expect(r.signedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 38 — primary key", () => {
  it("uuid", () => expect(sql134).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 38 — empty payload hash", () => {
  it("still hashes", () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    expect(band.packageHash("")).toHaveLength(64);
  });
});

describe("Sprint 38 — signature non-empty", () => {
  it("present", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    expect(r.signature.length).toBeGreaterThan(10);
  });
});

describe("Sprint 38 — store then retrieve", () => {
  it("round trip", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    band.storeSignedPackage(r);
    expect(band.getStoredPackage(r.id)?.packageHash).toBe(r.packageHash);
  });
});

describe("Sprint 38 — key rotation new key", () => {
  it("different signature", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const a = await band.signEvidencePackage(U1, "p", "key-a");
    const b = await band.signEvidencePackage(U1, "p", "key-b");
    expect(a.signature).not.toBe(b.signature);
  });
});

describe("Sprint 38 — package_hash index", () => {
  it("index", () => expect(sql134).toMatch(/idx_wasm_signed_pkg_hash/i));
});

describe("Sprint 38 — user_id index", () => {
  it("index", () => expect(sql134).toMatch(/idx_wasm_signed_pkg_user/i));
});

describe("Sprint 38 — signed_at column", () => {
  it("timestamptz", () => expect(sql134).toMatch(/signed_at\s+TIMESTAMPTZ/i));
});

describe("Sprint 38 — detectTamper false when intact", () => {
  it("no tamper", async () => {
    const band = new WasmSignedPackagePhase4Band(new Zone2WasmServiceStub());
    const r = await band.signEvidencePackage(U1, "p", "k");
    expect(band.detectTamper(r, "p")).toBe(false);
  });
});

describe("Sprint 38 — signPackageRemote spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (h: string, k: string) => new Zone2WasmServiceStub().signPackageRemote(h, k));
    const band = new WasmSignedPackagePhase4Band(delegatingZone2Wasm({ signPackageRemote: spy }));
    await band.signEvidencePackage(U1, "p", "k");
    expect(spy).toHaveBeenCalled();
  });
});
