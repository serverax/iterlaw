import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Sprint 18 admin API gate: Bearer token must match ITERLAW_ADMIN_API_TOKEN.
 * When the env var is unset, admin routes return 503 (fail-closed).
 */
export function requireAdminBearer(req: NextRequest): NextResponse | null {
  const expected = process.env.ITERLAW_ADMIN_API_TOKEN;
  if (!expected || expected.length < 8) {
    return NextResponse.json({ error: "admin_auth_not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const token = m?.[1]?.trim();
  if (!token || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
