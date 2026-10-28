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

export interface DocumentIngestRequest {
  title: string;
  content: string;
  tenant_id: string;
  security_scope: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentIngestResponse {
  document_id: string;
  title: string;
  tenant_id: string;
  security_scope: string;
  chunk_count: number;
  content_hash: string;
  corpus_version: string;
  created_at: string;
}

export interface DocumentSummary {
  document_id: string;
  title: string;
  tenant_id: string;
  security_scope: string;
  chunk_count: number;
  content_hash: string;
  created_at: string;
}

export interface QueryRequest {
  query: string;
  tenant_id: string;
  security_scope: string;
  top_k?: number;
  bypass_cache?: boolean;
  similarity_threshold?: number;
  conversation_id?: string;
}

export interface QueryCitation {
  document_id: string;
  chunk_id: string;
  document_title?: string;
  score: number;
  text_snippet: string;
}

export interface QueryTelemetry {
  cache_status: 'HIT_EXACT' | 'HIT_SEMANTIC' | 'MISS' | 'BYPASS' | string;
  similarity_score?: number;
  route: 'small' | 'large' | 'cache' | string;
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
  query: string;
  answer: string;
  citations: QueryCitation[];
  telemetry: QueryTelemetry;
  created_at?: string;
}

export interface CacheEntrySchema {
  id: string;
  tenant_id: string;
  security_scope: string;
  cache_key: string;
  query_text: string;
  normalized_query: string;
  response_text: string;
  citations: QueryCitation[];
  embedding_model_version: string;
  corpus_version: string;
  prompt_version: string;
  generation_params_hash: string;
  ttl_seconds: number;
  expires_at: string;
  hit_count: number;
  created_at: string;
  last_accessed_at: string;
}

export interface CacheInvalidateRequest {
  tenant_id: string;
  security_scope?: string;
  corpus_version?: string;
}

export interface CacheInvalidateResponse {
  invalidated_count: number;
  tenant_id: string;
  message: string;
  timestamp: string;
}

export interface CacheMetrics {
  total_entries: number;
  exact_hit_count: number;
  semantic_hit_count: number;
  miss_count: number;
  bypass_count: number;
  hit_rate_percentage: number;
  estimated_cost_avoided_usd: number;
  is_authoritative_billing: boolean;
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
