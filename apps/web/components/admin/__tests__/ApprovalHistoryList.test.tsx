/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { ApprovalHistoryList } from "@/components/admin/ApprovalHistoryList";
import type { ApprovalHistoryEntry } from "@/lib/admin/caseApprovalQueue";

describe("ApprovalHistoryList", () => {
  it("shows empty message", () => {
    render(<ApprovalHistoryList entries={[]} />);
    expect(screen.getByTestId("approval-history-empty")).toBeInTheDocument();
  });

  it("renders rows", () => {
    const entries: ApprovalHistoryEntry[] = [
      {
        id: "h1",
        caseId: "c1",
        approverId: "a1",
        status: "APPROVED",
        reason: null,
        createdAt: "2030-01-01T00:00:00.000Z",
      },
    ];
    render(<ApprovalHistoryList entries={entries} />);
    expect(screen.getByTestId("approval-history-table")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });
});
