import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  tierDailyRequestBudget,
  tierRateLimitColumn,
  isSubscriptionTier,
  hashApiKey,
  verifyApiKey,
  signJwtHs256,
  verifyJwtHs256,
  issueAccessAndRefresh,
  rotateWithRefresh,
  TierDailyRateLimiter,
} from "../memberAuth/index.js";

describe("Sprint 17 — password hashing", () => {
  it("round-trips a typical password", () => {
    const h = hashPassword("correct-horse-battery-staple");
    expect(verifyPassword("correct-horse-battery-staple", h)).toBe(true);
  });

  it("rejects wrong password", () => {
    const h = hashPassword("secret-one");
    expect(verifyPassword("secret-two", h)).toBe(false);
  });

  it("rejects empty stored hash", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", null as unknown as string)).toBe(false);
  });

  it("rejects malformed stored hash", () => {
    expect(verifyPassword("x", "bcrypt$foo")).toBe(false);
    expect(verifyPassword("x", "scrypt$onlyone")).toBe(false);
    expect(verifyPassword("x", "scrypt$zz$nothex")).toBe(false);
  });

  it("produces distinct hashes for the same password (salt)", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
    expect(verifyPassword("same", a)).toBe(true);
    expect(verifyPassword("same", b)).toBe(true);
  });

  it.each([
    ["a"],
    ["12345678"],
    ["unicode-你好"],
    ["with\nnewline"],
    [" "],
  ])("round-trip password %#", (pw) => {
    const h = hashPassword(pw);
    expect(verifyPassword(pw, h)).toBe(true);
  });
});

describe("Sprint 17 — subscription tiers", () => {
  it.each([
    ["FREE", 10],
    ["PRO", 1000],
    ["ENTERPRISE", null],
  ] as const)("tierDailyRequestBudget %s -> %s", (tier, expected) => {
    expect(tierDailyRequestBudget(tier)).toBe(expected);
  });

  it.each([
    ["FREE", 10],
    ["PRO", 1000],
    ["ENTERPRISE", null],
  ] as const)("tierRateLimitColumn %s matches budget", (tier, col) => {
    expect(tierRateLimitColumn(tier)).toBe(col);
  });

  it("isSubscriptionTier narrows string", () => {
    expect(isSubscriptionTier("FREE")).toBe(true);
    expect(isSubscriptionTier("PRO")).toBe(true);
    expect(isSubscriptionTier("ENTERPRISE")).toBe(true);
    expect(isSubscriptionTier("BASIC")).toBe(false);
    expect(isSubscriptionTier("")).toBe(false);
  });
});

describe("Sprint 17 — API key hash", () => {
  it("verify matches hash", () => {
    const raw = "iterlaw_test_key_12345678901234567890";
    const h = hashApiKey(raw);
    expect(verifyApiKey(raw, h)).toBe(true);
    expect(verifyApiKey(raw + "x", h)).toBe(false);
  });

  it("different keys produce different hashes", () => {
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });

  it.each(["k1", "k2", "long-" + "x".repeat(40)])("stable hash for %#", (raw) => {
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });
});

describe("Sprint 17 — JWT HS256", () => {
  const secret = "test-secret-at-least-32-chars-long!!";

  it("signs and verifies access token", () => {
    const t = signJwtHs256(secret, { sub: "user-1", typ: "access" }, 120, 1_700_000_000);
    const v = verifyJwtHs256(secret, t, 1_700_000_030);
    expect(v.sub).toBe("user-1");
    expect(v.typ).toBe("access");
  });

  it("rejects wrong secret", () => {
    const t = signJwtHs256(secret, { sub: "u", typ: "access" }, 60, 1_800_000_000);
    expect(() => verifyJwtHs256(secret + "x", t, 1_800_000_010)).toThrow("jwt_bad_signature");
  });

  it("rejects expired token", () => {
    const t = signJwtHs256(secret, { sub: "u", typ: "access" }, 10, 1_800_000_000);
    expect(() => verifyJwtHs256(secret, t, 1_800_000_020)).toThrow("jwt_expired");
  });

  it("rejects malformed token", () => {
    expect(() => verifyJwtHs256(secret, "nope", 1)).toThrow("jwt_malformed");
    expect(() => verifyJwtHs256(secret, "a.b", 1)).toThrow("jwt_malformed");
  });

  it("rejects bad typ", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "u", typ: "bogus", iat: 1, exp: 9_999_999_999 }),
      "utf8",
    ).toString("base64url");
    const data = `${header}.${payload}`;
    const sig = createHmac("sha256", secret).update(data).digest("base64url");
    expect(() => verifyJwtHs256(secret, `${data}.${sig}`, 1)).toThrow("jwt_bad_claims");
  });

  it("issueAccessAndRefresh returns verifiable pair", () => {
    const pair = issueAccessAndRefresh(secret, "uid-99", 60, 3600, 2_000_000_000);
    const a = verifyJwtHs256(secret, pair.accessToken, 2_000_000_010);
    const r = verifyJwtHs256(secret, pair.refreshToken, 2_000_000_010);
    expect(a.typ).toBe("access");
    expect(r.typ).toBe("refresh");
    expect(a.sub).toBe("uid-99");
  });

  it("rotateWithRefresh issues new pair", () => {
    const pair = issueAccessAndRefresh(secret, "uid-2", 30, 600, 2_010_000_000);
    const next = rotateWithRefresh(secret, pair.refreshToken, 30, 600, 2_010_000_100);
    expect(verifyJwtHs256(secret, next.accessToken, 2_010_000_110).sub).toBe("uid-2");
  });

  it("rotateWithRefresh rejects access token", () => {
    const pair = issueAccessAndRefresh(secret, "uid-3", 30, 600, 2_020_000_000);
    expect(() => rotateWithRefresh(secret, pair.accessToken, 30, 600, 2_020_000_010)).toThrow("jwt_not_refresh");
  });

  it.each([0, 1, 3600, 86_400])("ttl %# seconds produces valid exp window", (ttl) => {
    const now = 2_030_000_000;
    const t = signJwtHs256(secret, { sub: "subj", typ: "access" }, ttl, now);
    const v = verifyJwtHs256(secret, t, now + ttl - 1);
    expect(v.exp).toBe(now + ttl);
  });
});

describe("Sprint 17 — TierDailyRateLimiter", () => {
  it("allows FREE tier up to 10 per UTC day", () => {
    const clock = () => new Date("2030-06-01T12:00:00.000Z");
    const lim = new TierDailyRateLimiter(clock);
    for (let i = 0; i < 10; i++) {
      expect(lim.consume("u1", "FREE").allowed).toBe(true);
    }
    expect(lim.consume("u1", "FREE").allowed).toBe(false);
  });

  it("PRO tier allows 1000", () => {
    const clock = () => new Date("2030-06-02T00:00:00.000Z");
    const lim = new TierDailyRateLimiter(clock);
    for (let i = 0; i < 999; i++) {
      lim.consume("u2", "PRO");
    }
    const r = lim.consume("u2", "PRO");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
    expect(lim.consume("u2", "PRO").allowed).toBe(false);
  });

  it("ENTERPRISE is unlimited", () => {
    const lim = new TierDailyRateLimiter(() => new Date("2030-06-03T00:00:00.000Z"));
    for (let i = 0; i < 50; i++) {
      expect(lim.consume("u3", "ENTERPRISE").allowed).toBe(true);
    }
  });

  it("resets counter on UTC day rollover", () => {
    let d = new Date("2030-07-01T23:00:00.000Z");
    const lim = new TierDailyRateLimiter(() => d);
    for (let i = 0; i < 10; i++) {
      expect(lim.consume("u4", "FREE").allowed).toBe(true);
    }
    expect(lim.consume("u4", "FREE").allowed).toBe(false);
    d = new Date("2030-07-02T00:00:00.000Z");
    expect(lim.consume("u4", "FREE").allowed).toBe(true);
  });

  it("reset() clears state", () => {
    const lim = new TierDailyRateLimiter(() => new Date("2030-08-01T00:00:00.000Z"));
    lim.consume("u5", "FREE");
    lim.reset();
    expect(lim.consume("u5", "FREE").remaining).toBe(9);
  });

  it("isolates users", () => {
    const lim = new TierDailyRateLimiter(() => new Date("2030-08-02T00:00:00.000Z"));
    expect(lim.consume("a", "FREE").remaining).toBe(9);
    expect(lim.consume("b", "FREE").remaining).toBe(9);
  });
});
