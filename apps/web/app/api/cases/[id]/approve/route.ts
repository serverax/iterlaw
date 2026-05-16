import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminBearer } from "@/lib/admin/adminAuth";
import { approveCase } from "@/lib/admin/caseApprovalQueue";

const bodySchema = z
  .object({
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
  let approverId = req.headers.get("x-approver-id")?.trim() ?? "admin-approver-1";
  const raw = await req.text();
  if (raw.trim().length > 0) {
    try {
      const json: unknown = JSON.parse(raw);
      const parsed = bodySchema.safeParse(json);
      if (parsed.success && parsed.data.approver_id) {
        approverId = parsed.data.approver_id;
      }
    } catch {
      return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
    }
  }
  const updated = approveCase(id, approverId);
  if (!updated) {
    return NextResponse.json({ error: "case_not_pending" }, { status: 409 });
  }
  return NextResponse.json({ case: updated });
}
