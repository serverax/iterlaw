/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminCaseDetail } from "@/components/admin/AdminCaseDetail";
import type { AdminCaseSummary } from "@/lib/admin/caseApprovalQueue";

const ROW: AdminCaseSummary = {
  id: "cx",
  title: "Case X",
  primaryIssue: "holiday_pay",
  workspaceId: "wx",
  workflowStatus: "awaiting_approval",
};

describe("AdminCaseDetail", () => {
  it("shows empty state", () => {
    render(<AdminCaseDetail caseRow={null} onApprove={() => {}} onRequestReject={() => {}} />);
    expect(screen.getByTestId("admin-case-detail-empty")).toBeInTheDocument();
  });

  it("shows approve and reject when awaiting_approval", () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    render(<AdminCaseDetail caseRow={ROW} onApprove={onApprove} onRequestReject={onReject} />);
    fireEvent.click(screen.getByTestId("btn-approve"));
    fireEvent.click(screen.getByTestId("btn-reject"));
    expect(onApprove).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
  });

  it("hides actions when not awaiting", () => {
    const done: AdminCaseSummary = { ...ROW, workflowStatus: "approved" };
    render(<AdminCaseDetail caseRow={done} onApprove={() => {}} onRequestReject={() => {}} />);
    expect(screen.queryByTestId("btn-approve")).toBeNull();
  });
});
