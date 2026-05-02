/** @jest-environment jsdom */
import { FactReview } from '@/components/dashboard/FactReview';
import { fireEvent, render, screen } from '@testing-library/react';

describe('FactReview', () => {
  it('toggles confirmation state', () => {
    const facts = [
      { id: 'a', label: 'Role', value: 'Engineer', confidence: 0.9 },
      { id: 'b', label: 'Event', value: 'Meeting on Tuesday', confidence: 0.8 },
    ];
    const onChange = jest.fn();
    render(<FactReview facts={facts} onChange={onChange} />);

    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]!);
    expect(onChange).toHaveBeenCalledWith('a', true);
  });
});
