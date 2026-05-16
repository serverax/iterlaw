import { NextRequest, NextResponse } from "next/server";
import { requireAdminBearer } from "@/lib/admin/adminAuth";
import { listApprovalHistory } from "@/lib/admin/caseApprovalQueue";

/** GET /api/cases/history — admin approval audit (Sprint 18). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireAdminBearer(req);
  if (denied) {
    return denied;
  }
  return NextResponse.json({ entries: listApprovalHistory() });
}
