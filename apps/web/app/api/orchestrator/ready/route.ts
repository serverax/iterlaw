import { NextResponse } from "next/server";
import {
  forwardToOrchestrator,
  forwardFailureMessage,
} from "@/lib/orchestrator/proxy";

/**
 * GET /api/orchestrator/ready
 *
 * Proxies legal-orchestrator's /ready so the web app can render a
 * health indicator without ever holding the orchestrator URL or
 * credentials in the browser. Returns 503 with a sanitised body when
 * the orchestrator is unreachable; never leaks the upstream host.
 */
export async function GET(): Promise<NextResponse> {
  const result = await forwardToOrchestrator({
    path: "/ready",
    method: "GET",
    timeoutMs: 5_000,
  });

  if (!result.ok) {
    return NextResponse.json(
      { status: "unavailable", error: forwardFailureMessage(result.reason) },
      { status: 503 },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
}
