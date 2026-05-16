/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminCaseList } from "@/components/admin/AdminCaseList";
import type { AdminCaseSummary } from "@/lib/admin/caseApprovalQueue";

const SAMPLE: AdminCaseSummary[] = [
  {
    id: "c1",
    title: "T1",
    primaryIssue: "grievance",
    workspaceId: "w1",
    workflowStatus: "awaiting_approval",
  },
  {
    id: "c2",
    title: "T2",
    primaryIssue: "redundancy",
    workspaceId: "w2",
    workflowStatus: "approved",
  },
];

describe("AdminCaseList", () => {
  it("renders cases and highlights selection", () => {
    const onSelect = jest.fn();
    render(<AdminCaseList cases={SAMPLE} selectedId="c1" onSelect={onSelect} />);
    expect(screen.getByText("T1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("T2"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });
});
