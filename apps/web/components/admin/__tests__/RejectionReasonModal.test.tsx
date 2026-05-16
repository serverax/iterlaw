/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { RejectionReasonModal } from "@/components/admin/RejectionReasonModal";

describe("RejectionReasonModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RejectionReasonModal open={false} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(container.querySelector('[data-testid="rejection-modal"]')).toBeNull();
  });

  it("calls onConfirm with reason", () => {
    const onConfirm = jest.fn();
    render(<RejectionReasonModal open onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId("rejection-reason-input"), { target: { value: "bad docs" } });
    fireEvent.click(screen.getByTestId("rejection-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("bad docs");
  });

  it("calls onClose", () => {
    const onClose = jest.fn();
    render(<RejectionReasonModal open onClose={onClose} onConfirm={() => {}} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
