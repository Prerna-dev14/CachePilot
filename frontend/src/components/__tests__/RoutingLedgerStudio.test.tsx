import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingLedgerStudio } from '../RoutingLedgerStudio';
import { apiClient } from '../../services/apiClient';

describe('RoutingLedgerStudio Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders summary metrics, complexity simulator, and historical ledger records', async () => {
    vi.spyOn(apiClient, 'getMetricsSummary').mockResolvedValue({
      data: {
        total_requests: 12,
        cache_hits: 4,
        cache_hit_rate: 0.333,
        estimated_total_cost_usd: 0.000425,
        p50_latency_ms: 12.5,
        p95_latency_ms: 45.2,
        model_distribution: {
          'mock-fast-small': 6,
          'mock-reasoning-large': 2,
        },
      },
      requestId: 'req-metrics-1',
      latencyMs: 4,
    });

    vi.spyOn(apiClient, 'classifyQuery').mockResolvedValue({
      data: {
        query: 'Compare the tradeoffs between Redis exact caching and pgvector semantic retrieval.',
        complexity_score: 0.70,
        selected_tier: 'large',
        selected_model: 'mock-reasoning-large',
        reason_code: 'REASONING_REQUIRED',
        detected_signals: ["Comparative Trigger: 'compare'", "Comparative Trigger: 'tradeoff'"],
        threshold: 0.65,
      },
      requestId: 'req-classify-1',
      latencyMs: 3,
    });

    vi.spyOn(apiClient, 'listLedgerRequests').mockResolvedValue({
      data: [
        {
          id: 'led-1',
          request_id: 'req-test-abc',
          tenant_id: 'tenant-default',
          security_scope: 'default',
          query_text: 'What is the RPO limit?',
          cache_status: 'miss',
          route: 'small',
          route_reason: 'LOW_COMPLEXITY_DIRECT',
          prompt_tokens: 120,
          completion_tokens: 35,
          total_tokens: 155,
          estimated_cost_usd: 0.000112,
          is_authoritative_billing: false,
          latency_cache_ms: 1.2,
          latency_retrieval_ms: 3.5,
          latency_generation_ms: 8.2,
          latency_total_ms: 13.9,
          created_at: new Date().toISOString(),
        },
      ],
      requestId: 'req-ledger-list',
      latencyMs: 5,
    });

    render(<RoutingLedgerStudio selectedTenant="tenant-default" />);

    expect(screen.getByText('Cost-Aware Model Router & Usage Ledger')).toBeInTheDocument();
    expect(screen.getByText('Query Complexity Simulator')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // total requests
    });
    expect(screen.getByText('33.3%')).toBeInTheDocument(); // hit rate
    expect(screen.getByText(/\$0\.0004/)).toBeInTheDocument(); // formatted cost
    expect(screen.getAllByText('mock-reasoning-large').length).toBeGreaterThan(0);
    expect(screen.getByText('req-test-abc')).toBeInTheDocument();
    expect(screen.getByText('What is the RPO limit?')).toBeInTheDocument();
  });

  it('allows evaluating preset queries and inspects request diagnostics modal', async () => {
    vi.spyOn(apiClient, 'getMetricsSummary').mockResolvedValue({
      data: {
        total_requests: 1,
        cache_hits: 0,
        cache_hit_rate: 0,
        estimated_total_cost_usd: 0.0001,
        p50_latency_ms: 10,
        p95_latency_ms: 10,
        model_distribution: { 'mock-fast-small': 1 },
      },
      requestId: 'req-m',
      latencyMs: 2,
    });

    vi.spyOn(apiClient, 'classifyQuery').mockResolvedValue({
      data: {
        query: 'What is the default data retention period?',
        complexity_score: 0.15,
        selected_tier: 'small',
        selected_model: 'mock-fast-small',
        reason_code: 'LOW_COMPLEXITY_DIRECT',
        detected_signals: ['Simple Factual Lookup'],
        threshold: 0.65,
      },
      requestId: 'req-c',
      latencyMs: 2,
    });

    vi.spyOn(apiClient, 'listLedgerRequests').mockResolvedValue({
      data: [
        {
          id: 'led-2',
          request_id: 'req-modal-xyz',
          tenant_id: 'tenant-default',
          security_scope: 'default',
          query_text: 'What is the retention period?',
          cache_status: 'hit_exact',
          route: 'cache',
          route_reason: 'CACHE_HIT',
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0.0,
          is_authoritative_billing: false,
          latency_cache_ms: 0.8,
          latency_retrieval_ms: 0.0,
          latency_generation_ms: 0.0,
          latency_total_ms: 0.8,
          created_at: new Date().toISOString(),
        },
      ],
      requestId: 'req-l',
      latencyMs: 3,
    });

    vi.spyOn(apiClient, 'getLedgerRequestDetail').mockResolvedValue({
      data: {
        ledger_entry: {
          id: 'led-2',
          request_id: 'req-modal-xyz',
          tenant_id: 'tenant-default',
          security_scope: 'default',
          query_text: 'What is the retention period?',
          cache_status: 'hit_exact',
          route: 'cache',
          route_reason: 'CACHE_HIT',
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0.0,
          is_authoritative_billing: false,
          latency_cache_ms: 0.8,
          latency_retrieval_ms: 0.0,
          latency_generation_ms: 0.0,
          latency_total_ms: 0.8,
          created_at: new Date().toISOString(),
        },
        model_usages: [],
      },
      requestId: 'req-d',
      latencyMs: 2,
    });

    render(<RoutingLedgerStudio selectedTenant="tenant-default" />);

    // Click "Direct Lookup" preset
    const presetBtn = screen.getByRole('button', { name: 'Direct Lookup' });
    fireEvent.click(presetBtn);

    await waitFor(() => {
      expect(screen.getByText('LOW_COMPLEXITY_DIRECT')).toBeInTheDocument();
      expect(screen.getByText('Simple Factual Lookup')).toBeInTheDocument();
    });

    // Click inspect button on the ledger table row
    const inspectBtn = screen.getByRole('button', { name: 'Inspect' });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText('Request Diagnostics & Telemetry')).toBeInTheDocument();
      expect(screen.getByText(/Non-authoritative cost estimate/i)).toBeInTheDocument();
    });
  });
});
