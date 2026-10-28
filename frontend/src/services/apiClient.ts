import type {
  HealthLiveResponse,
  HealthReadyResponse,
  DocumentIngestRequest,
  DocumentIngestResponse,
  DocumentSummary,
  QueryRequest,
  QueryResponse,
  CacheEntrySchema,
  CacheMetrics,
  CacheInvalidateRequest,
  CacheInvalidateResponse,
  ClassifyQueryRequest,
  ClassifyQueryResponse,
  RequestLedgerEntry,
  RequestLedgerDetail,
  MetricsSummary,
  BenchmarkRunResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; requestId: string; latencyMs: number }> {
    const url = `${this.baseUrl}${path}`;
    const start = performance.now();
    const requestId = `ui-${Math.random().toString(36).substring(2, 10)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const latencyMs = Math.round(performance.now() - start);
      const resRequestId = response.headers.get('X-Request-ID') || requestId;

      if (!response.ok && response.status !== 503) {
        let errMsg = `API error: ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      return { data: data as T, requestId: resRequestId, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Error(`Failed to fetch ${path} (${latencyMs}ms): ${message}`);
    }
  }

  async getHealthLive(): Promise<{ data: HealthLiveResponse; requestId: string; latencyMs: number }> {
    return this.request<HealthLiveResponse>('/health/live');
  }

  async getHealthReady(): Promise<{ data: HealthReadyResponse; requestId: string; latencyMs: number }> {
    return this.request<HealthReadyResponse>('/health/ready');
  }

  async ingestDocument(doc: DocumentIngestRequest): Promise<{ data: DocumentIngestResponse; requestId: string; latencyMs: number }> {
    return this.request<DocumentIngestResponse>('/api/v1/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  }

  async listDocuments(tenantId: string, securityScope?: string): Promise<{ data: DocumentSummary[]; requestId: string; latencyMs: number }> {
    let url = `/api/v1/documents?tenant_id=${encodeURIComponent(tenantId)}`;
    if (securityScope) {
      url += `&security_scope=${encodeURIComponent(securityScope)}`;
    }
    return this.request<DocumentSummary[]>(url);
  }

  async executeQuery(queryReq: QueryRequest): Promise<{ data: QueryResponse; requestId: string; latencyMs: number }> {
    return this.request<QueryResponse>('/api/v1/query', {
      method: 'POST',
      body: JSON.stringify(queryReq),
    });
  }

  async getCacheEntries(tenantId: string): Promise<{ data: CacheEntrySchema[]; requestId: string; latencyMs: number }> {
    return this.request<CacheEntrySchema[]>(`/api/v1/cache/entries?tenant_id=${encodeURIComponent(tenantId)}`);
  }

  async getCacheMetrics(): Promise<{ data: CacheMetrics; requestId: string; latencyMs: number }> {
    return this.request<CacheMetrics>('/api/v1/cache/metrics');
  }

  async invalidateCache(req: CacheInvalidateRequest): Promise<{ data: CacheInvalidateResponse; requestId: string; latencyMs: number }> {
    return this.request<CacheInvalidateResponse>('/api/v1/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async classifyQuery(req: ClassifyQueryRequest): Promise<{ data: ClassifyQueryResponse; requestId: string; latencyMs: number }> {
    return this.request<ClassifyQueryResponse>('/api/v1/router/classify', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async listLedgerRequests(tenantId?: string, limit: number = 50): Promise<{ data: RequestLedgerEntry[]; requestId: string; latencyMs: number }> {
    let url = `/api/v1/ledger/requests?limit=${limit}`;
    if (tenantId) {
      url += `&tenant_id=${encodeURIComponent(tenantId)}`;
    }
    return this.request<RequestLedgerEntry[]>(url);
  }

  async getLedgerRequestDetail(requestId: string): Promise<{ data: RequestLedgerDetail; requestId: string; latencyMs: number }> {
    return this.request<RequestLedgerDetail>(`/api/v1/ledger/requests/${encodeURIComponent(requestId)}`);
  }

  async getMetricsSummary(tenantId?: string): Promise<{ data: MetricsSummary; requestId: string; latencyMs: number }> {
    const url = tenantId ? `/api/v1/metrics/summary?tenant_id=${encodeURIComponent(tenantId)}` : '/api/v1/metrics/summary';
    return this.request<MetricsSummary>(url);
  }

  async getEvaluationBenchmark(tenantId?: string): Promise<{ data: BenchmarkRunResponse; requestId: string; latencyMs: number }> {
    const url = tenantId ? `/api/v1/evaluation/benchmark?tenant_id=${encodeURIComponent(tenantId)}` : '/api/v1/evaluation/benchmark';
    return this.request<BenchmarkRunResponse>(url);
  }

  async runEvaluationBenchmark(tenantId?: string): Promise<{ data: BenchmarkRunResponse; requestId: string; latencyMs: number }> {
    const url = tenantId ? `/api/v1/evaluation/run?tenant_id=${encodeURIComponent(tenantId)}` : '/api/v1/evaluation/run';
    return this.request<BenchmarkRunResponse>(url, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);


