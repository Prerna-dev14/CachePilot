import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';

describe('Header component', () => {
  it('renders brand title and active phase indicator', () => {
    render(
      <Header
        isLive={true}
        isReady={true}
        correlationId="cpilot-trace-123"
        selectedTenant="tenant-default"
        onTenantChange={vi.fn()}
      />
    );

    expect(screen.getByText('CachePilot')).toBeInTheDocument();
    expect(screen.getByText('Phase 0/1 Verified')).toBeInTheDocument();
    expect(screen.getByText('cpilot-trace-123')).toBeInTheDocument();
  });

  it('triggers onTenantChange when new tenant is selected', () => {
    const handleTenantChange = vi.fn();
    render(
      <Header
        isLive={true}
        isReady={true}
        correlationId="cpilot-trace-123"
        selectedTenant="tenant-default"
        onTenantChange={handleTenantChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'tenant-finance' } });
    expect(handleTenantChange).toHaveBeenCalledWith('tenant-finance');
  });
});
