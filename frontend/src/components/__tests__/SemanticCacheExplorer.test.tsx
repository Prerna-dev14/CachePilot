import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SemanticCacheExplorer } from '../SemanticCacheExplorer';
import { apiClient } from '../../services/apiClient';

describe('SemanticCacheExplorer Component', () => {
  it('renders metrics cards, threshold simulator, and cached entries', async () => {
    vi.spyOn(apiClient, 'getCacheMetrics').mockResolvedValue({
      data: {
        total_entries: 3,
        exact_hit_count: 5,
        semantic_hit_count: 2,
        miss_count: 3,
        bypass_count: 1,
        hit_rate_percentage: 70.0,
        estimated_cost_avoided_usd: 0.003500,
        is_authoritative_billing: false,
      },
      requestId: 'req-metrics-1',
      latencyMs: 4,
    });

    vi.spyOn(apiClient, 'getCacheEntries').mockResolvedValue({
      data: [
        {
          id: 'ce-test-1',
          tenant_id: 'tenant-default',
          security_scope: 'default',
          cache_key: 'sha256-mock-key-1234567890',
          query_text: 'What is the autoscaling limit?',
          normalized_query: 'what is the autoscaling limit',
          response_text: 'Autoscaling limit is 10 instances.',
          citations: [],
          embedding_model_version: 'mock-embedding-v1',
          corpus_version: 'v1.0.0',
          prompt_version: 'v1.0.0',
          generation_params_hash: 'default',
          ttl_seconds: 86400,
          expires_at: '2026-10-29T12:00:00Z',
          hit_count: 4,
          created_at: '2026-10-28T12:00:00Z',
          last_accessed_at: '2026-10-28T12:30:00Z',
        },
      ],
      requestId: 'req-entries-1',
      latencyMs: 5,
    });

    render(<SemanticCacheExplorer selectedTenant="tenant-default" />);

    expect(screen.getByText('Phase 3: Scope-Aware Semantic Cache')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('70.0%')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('$0.003500')).toBeInTheDocument();
      expect(screen.getByText('"What is the autoscaling limit?"')).toBeInTheDocument();
    });
  });

  it('triggers purge cache API when Purge Tenant Cache is clicked', async () => {
    vi.spyOn(apiClient, 'getCacheMetrics').mockResolvedValue({
      data: {
        total_entries: 0,
        exact_hit_count: 0,
        semantic_hit_count: 0,
        miss_count: 0,
        bypass_count: 0,
        hit_rate_percentage: 0.0,
        estimated_cost_avoided_usd: 0.0,
        is_authoritative_billing: false,
      },
      requestId: 'req-m-2',
      latencyMs: 2,
    });

    vi.spyOn(apiClient, 'getCacheEntries').mockResolvedValue({
      data: [],
      requestId: 'req-e-2',
      latencyMs: 2,
    });

    const purgeSpy = vi.spyOn(apiClient, 'invalidateCache').mockResolvedValue({
      data: {
        invalidated_count: 2,
        tenant_id: 'tenant-default',
        message: 'Purged 2 entries',
        timestamp: '2026-10-28T12:00:00Z',
      },
      requestId: 'req-inv-1',
      latencyMs: 3,
    });

    render(<SemanticCacheExplorer selectedTenant="tenant-default" />);

    const purgeBtn = screen.getByRole('button', { name: /Purge Tenant Cache/i });
    fireEvent.click(purgeBtn);

    await waitFor(() => {
      expect(purgeSpy).toHaveBeenCalledWith({ tenant_id: 'tenant-default' });
      expect(screen.getByText(/Successfully invalidated 2 entries for tenant-default/i)).toBeInTheDocument();
    });
  });
});
