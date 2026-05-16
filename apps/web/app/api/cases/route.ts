import { NextRequest, NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/admin/adminAuth";
import { listAdminCases } from "@/lib/admin/caseApprovalQueue";

/**
 * GET /api/cases — admin list of workspace cases (Sprint 18).
 * Query: ?filter=pending|all (default all)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdminBearer(req);
  if (denied) {
    return denied;
  }
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter");
  const list = listAdminCases(filter === "pending" ? "pending" : "all");
  return NextResponse.json({ cases: list });
}
