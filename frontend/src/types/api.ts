/**
 * CachePilot API Contract Types
 */

export interface HealthLiveResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface DependencyStatus {
  status: 'connected' | 'fallback_in_memory' | 'unhealthy' | string;
  latency_ms?: number;
  error?: string;
  mode?: string;
}

export interface HealthReadyResponse {
  status: 'ready' | 'unhealthy' | string;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
  timestamp: string;
  config_summary?: Record<string, unknown>;
}

export interface QueryRequest {
  query: string;
  tenant_id: string;
  security_scope: string;
  bypass_cache?: boolean;
  similarity_threshold?: number;
  conversation_id?: string;
}

export interface QueryCitation {
  document_id: string;
  chunk_id: string;
  score: number;
  text_snippet: string;
}

export interface QueryTelemetry {
  cache_status: 'HIT_EXACT' | 'HIT_SEMANTIC' | 'MISS' | 'BYPASS';
  similarity_score?: number;
  route: 'small' | 'large' | 'cache';
  route_reason: string;
  tokens: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  estimated_cost_usd: number;
  is_authoritative_billing: boolean;
  latencies_ms: {
    cache_lookup: number;
    retrieval: number;
    generation: number;
    total: number;
  };
}

export interface QueryResponse {
  request_id: string;
  answer: string;
  citations: QueryCitation[];
  telemetry: QueryTelemetry;
}

export interface MetricsSummary {
  total_requests: number;
  cache_hits: number;
  cache_hit_rate: number;
  estimated_total_cost_usd: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  model_distribution: Record<string, number>;
}
