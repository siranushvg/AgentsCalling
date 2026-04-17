import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders children text', () => {
    render(<StatusBadge variant="active">Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies correct variant class for active', () => {
    const { container } = render(<StatusBadge variant="active">Test</StatusBadge>);
    expect(container.firstChild).toHaveClass('bg-success/15');
  });

  it('applies correct variant class for hot', () => {
    const { container } = render(<StatusBadge variant="hot">Hot</StatusBadge>);
    expect(container.firstChild).toHaveClass('bg-hot/15');
  });

  it('applies destructive style for failed', () => {
    const { container } = render(<StatusBadge variant="failed">Failed</StatusBadge>);
    expect(container.firstChild).toHaveClass('bg-destructive/15');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge variant="active" className="extra-class">Test</StatusBadge>);
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('uses default variant when none specified', () => {
    const { container } = render(<StatusBadge>Default</StatusBadge>);
    expect(container.firstChild).toHaveClass('bg-success/15');
  });
});
