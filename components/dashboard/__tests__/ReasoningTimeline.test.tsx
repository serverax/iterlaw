/** @jest-environment jsdom */
import { ReasoningTimeline } from '@/components/dashboard/ReasoningTimeline';
import { render, screen } from '@testing-library/react';

describe('ReasoningTimeline', () => {
  it('renders all steps', () => {
    render(
      <ReasoningTimeline
        steps={[
          { step: 1, title: 'A', summary: 'alpha' },
          { step: 2, title: 'B', summary: 'beta', statutoryAnchor: 'ERA 1996' },
        ]}
      />
    );
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    expect(screen.getByText(/Anchor: ERA 1996/)).toBeInTheDocument();
  });
});
