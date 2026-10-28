import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryDashboard } from '../TelemetryDashboard';
import { apiClient } from '../../services/apiClient';

describe('TelemetryDashboard Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockMetrics = {
    total_requests: 25,
    cache_hits: 15,
    cache_hit_rate: 0.60,
    estimated_total_cost_usd: 0.001250,
    estimated_cost_avoided_usd: 0.002250,
    p50_latency_ms: 8.5,
    p95_latency_ms: 22.1,
    model_distribution: {
      'mock-fast-small': 7,
      'mock-reasoning-large': 3,
    },
    exact_hits: 10,
    semantic_hits: 5,
    misses: 8,
    bypasses: 2,
    is_authoritative_billing: false,
    avg_latency_breakdown: {
      cache_ms: 1.8,
      retrieval_ms: 4.2,
      generation_ms: 12.5,
      total_ms: 18.5,
    },
    error_count: 0,
  };

  const mockBenchmark = {
    run_id: 'eval-run-abc12345',
    timestamp: new Date().toISOString(),
    tenant_id: 'tenant-default',
    benchmark_dataset_version: 'v1.0.0-enterprise-eval',
    total_queries: 8,
    cache_hit_count: 2,
    cache_hit_rate_percent: 25.0,
    small_model_route_percent: 37.5,
    large_model_route_percent: 37.5,
    total_baseline_cost_usd: 0.001060,
    total_cpilot_cost_usd: 0.000424,
    overall_cost_reduction_percent: 62.5,
    avg_baseline_latency_ms: 32.5,
    avg_cpilot_latency_ms: 16.5,
    overall_latency_reduction_percent: 49.2,
    citation_coverage_percent: 100.0,
    is_authoritative_billing: false,
    items: [
      {
        query_id: 'eval-1',
        category: 'direct_lookup',
        query: 'What is the default data retention period?',
        baseline_model: 'mock-reasoning-large',
        baseline_cost_usd: 0.000132,
        baseline_latency_ms: 32.5,
        cpilot_cache_status: 'miss',
        cpilot_route: 'small',
        cpilot_model: 'mock-fast-small',
        cpilot_route_reason: 'LOW_COMPLEXITY_DIRECT',
        cpilot_cost_usd: 0.000013,
        cpilot_latency_ms: 14.2,
        cost_reduction_percent: 90.0,
        latency_reduction_percent: 56.3,
        citation_count: 1,
        grounded_faithfulness_score: 1.0,
      },
    ],
  };

  it('renders operational KPIs, model distributions, and benchmark comparative cards', async () => {
    vi.spyOn(apiClient, 'getMetricsSummary').mockResolvedValue({
      data: mockMetrics,
      requestId: 'req-m-1',
      latencyMs: 3,
    });

    vi.spyOn(apiClient, 'getEvaluationBenchmark').mockResolvedValue({
      data: mockBenchmark,
      requestId: 'req-b-1',
      latencyMs: 4,
    });

    render(<TelemetryDashboard selectedTenant="tenant-default" />);

    expect(screen.getByText('Phase 5: Telemetry Dashboard & Quality Evaluation')).toBeInTheDocument();
    expect(screen.getByText(/Financial Disclosures/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // total requests
      expect(screen.getByText('60.0%')).toBeInTheDocument(); // hit rate
      expect(screen.getByText('$0.00125')).toBeInTheDocument(); // spend
      expect(screen.getByText('$0.00225')).toBeInTheDocument(); // cost avoided
      expect(screen.getByText('62.5%')).toBeInTheDocument(); // cost reduction
      expect(screen.getByText('49.2%')).toBeInTheDocument(); // latency reduction
      expect(screen.getByText('eval-1')).toBeInTheDocument();
    });
  });

  it('runs benchmark evaluation when Run Benchmark Suite button is clicked', async () => {
    vi.spyOn(apiClient, 'getMetricsSummary').mockResolvedValue({
      data: mockMetrics,
      requestId: 'req-m-2',
      latencyMs: 2,
    });

    vi.spyOn(apiClient, 'getEvaluationBenchmark').mockResolvedValue({
      data: mockBenchmark,
      requestId: 'req-b-2',
      latencyMs: 3,
    });

    const runSpy = vi.spyOn(apiClient, 'runEvaluationBenchmark').mockResolvedValue({
      data: {
        ...mockBenchmark,
        run_id: 'eval-run-new789',
        overall_cost_reduction_percent: 65.5,
      },
      requestId: 'req-b-run',
      latencyMs: 15,
    });

    render(<TelemetryDashboard selectedTenant="tenant-default" />);

    const runBtn = screen.getByRole('button', { name: /Run Benchmark Suite/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(runSpy).toHaveBeenCalledWith('tenant-default');
      expect(screen.getByText('65.5%')).toBeInTheDocument();
    });
  });
});
