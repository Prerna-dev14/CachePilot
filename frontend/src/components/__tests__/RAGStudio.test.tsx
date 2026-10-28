import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RAGStudio } from '../RAGStudio';
import { apiClient } from '../../services/apiClient';

describe('RAGStudio Component', () => {
  it('renders ingestion form, corpus list, and query console', () => {
    vi.spyOn(apiClient, 'listDocuments').mockResolvedValue({
      data: [
        {
          document_id: 'doc-test-1',
          title: 'Test Security Policy',
          tenant_id: 'tenant-default',
          security_scope: 'default',
          chunk_count: 2,
          content_hash: 'hash123',
          created_at: '2026-10-28T12:00:00Z',
        },
      ],
      requestId: 'req-test-list',
      latencyMs: 5,
    });

    render(<RAGStudio selectedTenant="tenant-default" />);

    expect(screen.getByText('Phase 2: Baseline RAG Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Ingest Knowledge Document')).toBeInTheDocument();
    expect(screen.getByText('Grounded RAG Query Console')).toBeInTheDocument();
  });

  it('populates document content when preset button is clicked', () => {
    render(<RAGStudio selectedTenant="tenant-default" />);

    const securityPresetBtn = screen.getByRole('button', { name: 'Security' });
    fireEvent.click(securityPresetBtn);

    const titleInput = screen.getByPlaceholderText(/e.g. Q3 Financial Report/i) as HTMLInputElement;
    expect(titleInput.value).toBe('CachePilot Scope & Security Isolation Policy');
  });

  it('submits a query and displays grounded response with citations', async () => {
    vi.spyOn(apiClient, 'executeQuery').mockResolvedValue({
      data: {
        request_id: 'req-rag-trace-42',
        query: 'What is CachePilot?',
        answer: 'CachePilot is an observable RAG gateway with semantic caching.',
        citations: [
          {
            document_id: 'doc-1',
            chunk_id: 'chk-1-0',
            document_title: 'Security Policy',
            score: 0.94,
            text_snippet: 'CachePilot enforces multi-tenant isolation.',
          },
        ],
        telemetry: {
          cache_status: 'MISS',
          similarity_score: 0.94,
          route: 'small',
          route_reason: 'BASELINE_RAG_DIRECT',
          tokens: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
          estimated_cost_usd: 0.000015,
          is_authoritative_billing: false,
          latencies_ms: { cache_lookup: 0.0, retrieval: 4.2, generation: 12.5, total: 16.7 },
        },
      },
      requestId: 'req-rag-trace-42',
      latencyMs: 17,
    });

    render(<RAGStudio selectedTenant="tenant-default" />);

    const queryInput = screen.getByPlaceholderText(/Ask a question grounded/i);
    fireEvent.change(queryInput, { target: { value: 'What is CachePilot?' } });

    const runBtn = screen.getByRole('button', { name: /Run Query/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText('Grounded Answer')).toBeInTheDocument();
      expect(screen.getByText(/CachePilot is an observable RAG gateway/i)).toBeInTheDocument();
      expect(screen.getByText(/Trace: req-rag-trace-42/i)).toBeInTheDocument();
      expect(screen.getByText(/Similarity: 94.0%/i)).toBeInTheDocument();
    });
  });
});
