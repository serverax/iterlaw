import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  forwardToOrchestrator,
  forwardFailureMessage,
} from "@/lib/orchestrator/proxy";

/**
 * POST /api/orchestrator/legal/ask
 *
 * Thin proxy to legal-orchestrator's /api/legal/ask. The client supplies
 * the question + facts + mode; this route stamps request_id, user_id,
 * and workspace_id from the session (or anonymous sid) so the browser
 * can never spoof identity fields.
 *
 * The orchestrator's existing safety contract (citation gates, no
 * external LLM) is unchanged — this route is transport only.
 */

const clientBodySchema = z
  .object({
    mode: z
      .enum(["ask", "document_review", "draft", "deadline", "risk"])
      .default("ask"),
    question: z.string().min(1).max(4000).optional(),
    document_id: z.string().min(1).max(200).optional(),
    document_text: z.string().min(1).max(40000).optional(),
    legal_pack: z.string().min(1).max(80).optional(),
    case_id: z.string().min(1).max(200).optional(),
    facts: z.record(z.unknown()).optional(),
  })
  .strict();

const ANON_COOKIE = "iterlaw_anon_sid";

function identitySlice(): { request_id: string; user_id: string; workspace_id: string } {
  const sid = cookies().get(ANON_COOKIE)?.value;
  const userId = sid ? `anon:${sid}` : `anon:${crypto.randomUUID()}`;
  return {
    request_id: crypto.randomUUID(),
    user_id: userId,
    workspace_id: userId,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const parsed = clientBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const identity = identitySlice();
  const body = { ...identity, ...parsed.data };

  const result = await forwardToOrchestrator({
    path: "/api/legal/ask",
    method: "POST",
    body,
    timeoutMs: 60_000,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: forwardFailureMessage(result.reason) },
      { status: result.status === 504 ? 504 : 502 },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
}
