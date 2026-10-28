import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SystemHealthCard } from '../SystemHealthCard';

describe('SystemHealthCard component', () => {
  it('renders healthy dependencies when data is provided', () => {
    const liveData = {
      status: 'healthy',
      service: 'cachepilot',
      version: '1.0.0',
      timestamp: '2026-10-28T12:00:00Z',
    };
    const readyData = {
      status: 'ready',
      dependencies: {
        database: { status: 'connected', latency_ms: 1.5 },
        redis: { status: 'connected', latency_ms: 0.9 },
      },
      timestamp: '2026-10-28T12:00:00Z',
    };

    render(
      <SystemHealthCard
        liveData={liveData}
        readyData={readyData}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        latencyMs={12}
      />
    );

    expect(screen.getByText('System Infrastructure & Health Probes')).toBeInTheDocument();
    expect(screen.getByText('200 OK')).toBeInTheDocument();
    expect(screen.getAllByText('connected')).toHaveLength(2);
  });

  it('renders error notice when backend is unreachable', () => {
    render(
      <SystemHealthCard
        liveData={null}
        readyData={null}
        loading={false}
        error="Failed to connect to port 8000"
        onRefresh={vi.fn()}
        latencyMs={0}
      />
    );

    expect(screen.getByText(/Failed to connect to port 8000/)).toBeInTheDocument();
  });

  it('triggers onRefresh when button is clicked', () => {
    const handleRefresh = vi.fn();
    render(
      <SystemHealthCard
        liveData={null}
        readyData={null}
        loading={false}
        error={null}
        onRefresh={handleRefresh}
        latencyMs={0}
      />
    );

    const button = screen.getByRole('button', { name: /Refresh Health/i });
    fireEvent.click(button);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});
