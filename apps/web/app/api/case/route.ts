import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  createAnonSession,
  getAnonSession,
  ANON_SESSION_TTL_MS,
} from "@/lib/anon-session/anon-session-store";

/**
 * /api/case — the surface the /case/assessment page (commit c) talks to.
 *
 * Phase 2C scope: in-memory anonymous case state only. No database
 * persistence; the existing anon-session store (15min TTL) holds the
 * narrative until it is consumed by the orchestrator preview or
 * promoted to a signed-in user case via /api/case/promote.
 *
 * Hard invariants:
 *   - Narrative is never echoed back to the client. We return only
 *     the session sid (also set as an httpOnly cookie) and a coarse
 *     state flag (has_preview_snapshot).
 *   - The cookie is httpOnly + sameSite=lax. Client JS cannot read it.
 *   - GET returns 404 when the session is expired or absent. No 5xx
 *     for that case — it's a normal not-found, not a server error.
 */

const ANON_COOKIE = "iterlaw_anon_sid";

const createBodySchema = z
  .object({
    narrative: z.string().min(12).max(12000),
  })
  .strict();

export async function POST(req: NextRequest): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = createAnonSession(parsed.data.narrative);
  const res = NextResponse.json(
    {
      sid: session.sid,
      created_at: new Date(session.createdAt).toISOString(),
      has_preview_snapshot: session.previewSnapshot !== null,
    },
    { status: 201 },
  );
  res.cookies.set(ANON_COOKIE, session.sid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ANON_SESSION_TTL_MS / 1000),
  });
  return res;
}

export async function GET(): Promise<NextResponse> {
  const sid = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  if (!sid) {
    return NextResponse.json({ error: "no_session" }, { status: 404 });
  }
  const session = getAnonSession(sid);
  if (!session) {
    return NextResponse.json({ error: "session_expired" }, { status: 404 });
  }
  return NextResponse.json({
    sid: session.sid,
    created_at: new Date(session.createdAt).toISOString(),
    has_preview_snapshot: session.previewSnapshot !== null,
  });
}
