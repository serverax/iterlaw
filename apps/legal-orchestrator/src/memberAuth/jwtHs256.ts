import { createHmac, timingSafeEqual } from "node:crypto";

export type JwtTyp = "access" | "refresh";

export interface VerifiedJwt {
  sub: string;
  typ: JwtTyp;
  iat: number;
  exp: number;
}

function b64urlEncodeJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function b64urlDecodeJson<T>(segment: string): T {
  const buf = Buffer.from(segment, "base64url");
  return JSON.parse(buf.toString("utf8")) as T;
}

/**
 * Minimal HS256 JWT (header.payload.signature) without external deps.
 */
export function signJwtHs256(
  secret: string,
  claims: { sub: string; typ: JwtTyp },
  ttlSeconds: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): string {
  const header = b64urlEncodeJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlEncodeJson({
    ...claims,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  });
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyJwtHs256(secret: string, token: string, nowSec: number = Math.floor(Date.now() / 1000)): VerifiedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("jwt_malformed");
  }
  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("jwt_bad_signature");
  }
  const header = b64urlDecodeJson<{ alg: string }>(h);
  if (header.alg !== "HS256") {
    throw new Error("jwt_bad_alg");
  }
  const body = b64urlDecodeJson<{ sub?: string; typ?: string; iat?: number; exp?: number }>(p);
  if (!body.sub || (body.typ !== "access" && body.typ !== "refresh")) {
    throw new Error("jwt_bad_claims");
  }
  if (typeof body.iat !== "number" || typeof body.exp !== "number") {
    throw new Error("jwt_bad_times");
  }
  if (body.exp <= nowSec) {
    throw new Error("jwt_expired");
  }
  return { sub: body.sub, typ: body.typ, iat: body.iat, exp: body.exp };
}

export function issueAccessAndRefresh(
  secret: string,
  userId: string,
  accessTtlSec: number,
  refreshTtlSec: number,
  nowSec?: number,
): { accessToken: string; refreshToken: string } {
  const t = nowSec ?? Math.floor(Date.now() / 1000);
  return {
    accessToken: signJwtHs256(secret, { sub: userId, typ: "access" }, accessTtlSec, t),
    refreshToken: signJwtHs256(secret, { sub: userId, typ: "refresh" }, refreshTtlSec, t),
  };
}

export function rotateWithRefresh(
  secret: string,
  refreshToken: string,
  accessTtlSec: number,
  refreshTtlSec: number,
  nowSec?: number,
): { accessToken: string; refreshToken: string } {
  const v = verifyJwtHs256(secret, refreshToken, nowSec);
  if (v.typ !== "refresh") {
    throw new Error("jwt_not_refresh");
  }
  return issueAccessAndRefresh(secret, v.sub, accessTtlSec, refreshTtlSec, nowSec);
}
