import { describe, it, expect } from "vitest";
import { fuseCalculatorScores, aggregateEdgeKinds } from "../coherentSystem/lawEngineBand.js";
import { crossEntropyBinary, calibrateRerankerConfidence } from "../coherentSystem/rerankerV2.js";
import {
  hnswEfSearchDefault,
  ollamaCacheTtlMs,
  streamingChunksOrdered,
} from "../coherentSystem/retrievalBand.js";
import { wasmLinearMemoryCeilingBytes, proofDigestHex, wasmGasEstimate } from "../coherentSystem/wasmBand.js";
import {
  caseVisibleAt,
  temporalHalfOpenOverlap,
} from "../coherentSystem/workspaceTemporalBand.js";
import {
  scoreEntityConfidence,
  chunkCoherenceScore,
  documentUploadMimeAllowed,
} from "../coherentSystem/documentIntelBand.js";

describe("Sprints 22–57 coherent law engine band", () => {
  for (let k = 0; k < 110; k++) {
    it(`fuseCalculatorScores deterministic ${k}`, () => {
      const a = (k % 10) / 10;
      const b = ((k + 3) % 10) / 10;
      const w1 = 0.3 + (k % 5) * 0.1;
      const w2 = 1 - w1;
      const v = fuseCalculatorScores([a, b], [w1, w2]);
      const v2 = fuseCalculatorScores([a, b], [w1, w2]);
      expect(v).toBe(v2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  }

  it("fuseCalculatorScores rejects length mismatch", () => {
    expect(() => fuseCalculatorScores([1], [1, 1])).toThrow();
  });

  it("aggregateEdgeKinds counts", () => {
    expect(
      aggregateEdgeKinds([
        { edgeKind: "CITES" },
        { edgeKind: "CITES" },
        { edgeKind: "RELATES" },
      ]),
    ).toEqual({ CITES: 2, RELATES: 1 });
  });

  for (let i = 0; i < 40; i++) {
    it(`crossEntropyBinary stable ${i}`, () => {
      const p = 0.05 + (i % 90) / 100;
      const ce0 = crossEntropyBinary(p, 0);
      const ce1 = crossEntropyBinary(p, 1);
      expect(ce0).toBeGreaterThan(0);
      expect(ce1).toBeGreaterThan(0);
      expect(ce0).not.toBe(ce1);
    });
  }

  for (let i = 0; i < 40; i++) {
    it(`calibrateRerankerConfidence ${i}`, () => {
      const raw = i / 100;
      const ce = (i % 5) * 0.2;
      const c = calibrateRerankerConfidence(raw, ce);
      expect(c).toBeLessThanOrEqual(raw + 1e-9);
      expect(c).toBeGreaterThanOrEqual(0);
    });
  }
});

describe("Sprints 22–57 coherent retrieval band", () => {
  for (let lists = 8; lists <= 64; lists++) {
    it(`hnswEfSearchDefault lists=${lists}`, () => {
      const ef = hnswEfSearchDefault(lists);
      expect(ef).toBeGreaterThanOrEqual(16);
      expect(ef).toBeLessThanOrEqual(200);
    });
  }

  it.each(["tiny-7b", "MODEL-70b-chat", "13b-fast"])("ollamaCacheTtlMs %s", (m) => {
    expect(ollamaCacheTtlMs(m)).toBeGreaterThan(0);
  });

  for (let n = 0; n < 50; n++) {
    it(`streamingChunksOrdered ${n}`, () => {
      expect(streamingChunksOrdered([{ seq: 0 }, { seq: 1 }, { seq: 2 }])).toBe(true);
      expect(streamingChunksOrdered([{ seq: 1 }, { seq: 2 }])).toBe(false);
      expect(streamingChunksOrdered([{ seq: 0 }, { seq: 2 }])).toBe(false);
    });
  }
});

describe("Sprints 22–57 coherent WASM band", () => {
  for (let mb = 1; mb <= 32; mb++) {
    it(`wasmLinearMemoryCeilingBytes ${mb}`, () => {
      expect(wasmLinearMemoryCeilingBytes(mb)).toBe(mb * 1024 * 1024);
    });
  }

  for (let i = 0; i < 40; i++) {
    it(`proofDigestHex ${i}`, () => {
      const h = proofDigestHex("m", "v1", `payload-${i}`);
      expect(h).toHaveLength(64);
      expect(proofDigestHex("m", "v1", `payload-${i}`)).toBe(h);
    });
  }

  for (let b = 0; b < 30; b++) {
    it(`wasmGasEstimate ${b}`, () => {
      expect(wasmGasEstimate(b)).toBeGreaterThanOrEqual(0);
    });
  }
});

describe("Sprints 22–57 coherent workspace temporal band", () => {
  for (let t = 0; t < 35; t++) {
    it(`caseVisibleAt ${t}`, () => {
      const base = 1_000_000 + t * 1000;
      expect(caseVisibleAt(base, base + 5000, base + 2000)).toBe(true);
      expect(caseVisibleAt(base, base + 5000, base + 9000)).toBe(false);
    });
  }

  for (let i = 0; i < 35; i++) {
    it(`temporalHalfOpenOverlap ${i}`, () => {
      expect(temporalHalfOpenOverlap(0, 10, 10, 20)).toBe(false);
      expect(temporalHalfOpenOverlap(0, 11, 10, 20)).toBe(true);
    });
  }
});

describe("Sprints 22–57 coherent document intel band", () => {
  it.each([0.1, 0.5, 0.9])("scoreEntityConfidence %f", (c) => {
    expect(["low", "med", "high"]).toContain(scoreEntityConfidence(c));
  });

  for (let i = 0; i < 45; i++) {
    it(`chunkCoherenceScore ${i}`, () => {
      const s = chunkCoherenceScore(`hello world ${i}`, `world hello ${i}`);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    });
  }

  for (let i = 0; i < 40; i++) {
    it(`documentUploadMimeAllowed ${i}`, () => {
      expect(documentUploadMimeAllowed("application/pdf")).toBe(true);
      expect(documentUploadMimeAllowed("application/octet-stream")).toBe(false);
    });
  }
});

describe("Sprints 22–57 coherentSystem barrel", () => {
  it("exports modules", async () => {
    const m = await import("../coherentSystem/index.js");
    expect(typeof m.fuseCalculatorScores).toBe("function");
    expect(typeof m.hnswEfSearchDefault).toBe("function");
    expect(typeof m.proofDigestHex).toBe("function");
  });
});
