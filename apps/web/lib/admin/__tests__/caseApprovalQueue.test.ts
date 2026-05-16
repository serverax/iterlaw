/**
 * @jest-environment node
 */
import { resetCaseApprovalQueueForTests, seedDefaultAdminCases, listAdminCases, getAdminCase, approveCase, rejectCase, listApprovalHistory } from "@/lib/admin/caseApprovalQueue";

describe("caseApprovalQueue", () => {
  beforeEach(() => {
    resetCaseApprovalQueueForTests();
  });

  it("seeds default demo cases on first access", () => {
    const all = listAdminCases("all");
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("filters pending cases", () => {
    const pending = listAdminCases("pending");
    expect(pending.every((c) => c.workflowStatus === "awaiting_approval")).toBe(true);
  });

  it("getAdminCase returns null for unknown id", () => {
    expect(getAdminCase("missing")).toBeNull();
  });

  it("getAdminCase returns row", () => {
    const c = getAdminCase("case-demo-1");
    expect(c?.title).toMatch(/Redundancy/);
  });

  it("approveCase updates workflow and appends history", () => {
    const ok = approveCase("case-demo-1", "approver-a");
    expect(ok?.workflowStatus).toBe("approved");
    const h = listApprovalHistory();
    expect(h[0]?.status).toBe("APPROVED");
    expect(h[0]?.approverId).toBe("approver-a");
  });

  it("approveCase returns null if not pending", () => {
    approveCase("case-demo-1", "a");
    expect(approveCase("case-demo-1", "b")).toBeNull();
  });

  it("rejectCase requires non-empty reason", () => {
    expect(rejectCase("case-demo-2", "x", "   ")).toBeNull();
  });

  it("rejectCase updates workflow and records reason", () => {
    const ok = rejectCase("case-demo-2", "rev-1", "  Missing tribunal dates ");
    expect(ok?.workflowStatus).toBe("rejected");
    const h = listApprovalHistory();
    expect(h.find((e) => e.status === "REJECTED")?.reason).toBe("Missing tribunal dates");
  });

  it("rejectCase returns null when not pending", () => {
    rejectCase("case-demo-2", "a", "r");
    expect(rejectCase("case-demo-2", "b", "r2")).toBeNull();
  });

  it("listApprovalHistory returns newest first", () => {
    resetCaseApprovalQueueForTests();
    seedDefaultAdminCases();
    approveCase("case-demo-1", "u1");
    rejectCase("case-demo-2", "u2", "no");
    const h = listApprovalHistory();
    expect(h.length).toBe(2);
    const first = h[0];
    const second = h[1];
    expect(first && second && first.createdAt >= second.createdAt).toBe(true);
  });

  it.each(["case-demo-1", "case-demo-2", "case-demo-3"])("seed includes case id %s", (id) => {
    seedDefaultAdminCases();
    expect(getAdminCase(id)).not.toBeNull();
  });
});
