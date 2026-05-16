import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminBearer } from "@/lib/admin/adminAuth";
import { rejectCase } from "@/lib/admin/caseApprovalQueue";

const bodySchema = z
  .object({
    reason: z.string().min(1).max(8000),
    approver_id: z.string().min(1).max(128).optional(),
  })
  .strict();

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const denied = requireAdminBearer(req);
  if (denied) {
    return denied;
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  let approverId = parsed.data.approver_id ?? req.headers.get("x-approver-id")?.trim() ?? "admin-approver-1";
  const updated = rejectCase(id, approverId, parsed.data.reason);
  if (!updated) {
    return NextResponse.json({ error: "case_not_pending_or_empty_reason" }, { status: 409 });
  }
  return NextResponse.json({ case: updated });
}
