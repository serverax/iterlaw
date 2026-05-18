import { render, screen } from '@testing-library/react';
import { Button } from '../button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Get Started</Button>);
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });
});
