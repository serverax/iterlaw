/** @jest-environment jsdom */
import { AxiomPulse } from '@/components/dashboard/AxiomPulse';
import { render, screen } from '@testing-library/react';

describe('AxiomPulse', () => {
  it('shows running copy', () => {
    render(<AxiomPulse status="running" />);
    expect(screen.getByText(/Working through statutes/)).toBeInTheDocument();
  });
});
