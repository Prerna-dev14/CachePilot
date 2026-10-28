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
  exact_hits?: number;
  semantic_hits?: number;
  misses?: number;
  bypasses?: number;
  estimated_cost_avoided_usd?: number;
  is_authoritative_billing?: boolean;
  route_reason_distribution?: Record<string, number>;
  avg_latency_breakdown?: {
    cache_ms?: number;
    retrieval_ms?: number;
    generation_ms?: number;
    total_ms?: number;
  };
  error_count?: number;
}

export interface RouteDecision {
  model_name: string;
  tier: 'small' | 'large' | string;
  reason_code: string;
  complexity_score: number;
  complexity_reasons: string[];
}

export interface ClassifyQueryRequest {
  query: string;
  context_token_estimate?: number;
  tenant_id?: string;
}

export interface ClassifyQueryResponse {
  query: string;
  complexity_score: number;
  selected_tier: 'small' | 'large' | string;
  selected_model: string;
  reason_code: string;
  detected_signals: string[];
  threshold: number;
}

export interface ModelUsageRecord {
  id: string;
  request_id: string;
  model_name: string;
  provider_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  unit_cost_input: number;
  unit_cost_output: number;
  estimated_cost_usd: number;
  latency_ms: number;
  created_at: string;
}

export interface RequestLedgerEntry {
  id: string;
  request_id: string;
  tenant_id: string;
  security_scope: string;
  query_text: string;
  cache_status: 'hit_exact' | 'hit_semantic' | 'miss' | 'bypass' | string;
  route: 'small' | 'large' | string;
  route_reason: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  is_authoritative_billing: boolean;
  latency_cache_ms: number;
  latency_retrieval_ms: number;
  latency_generation_ms: number;
  latency_total_ms: number;
  error_code?: string;
  created_at: string;
}

export interface RequestLedgerDetail {
  ledger_entry: RequestLedgerEntry;
  model_usages: ModelUsageRecord[];
}

export interface BenchmarkResultItem {
  query_id: string;
  category: string;
  query: string;
  baseline_model: string;
  baseline_cost_usd: number;
  baseline_latency_ms: number;
  cpilot_cache_status: string;
  cpilot_route: string;
  cpilot_model: string;
  cpilot_route_reason: string;
  cpilot_cost_usd: number;
  cpilot_latency_ms: number;
  cost_reduction_percent: number;
  latency_reduction_percent: number;
  citation_count: number;
  grounded_faithfulness_score: number;
}

export interface BenchmarkRunResponse {
  run_id: string;
  timestamp: string;
  tenant_id: string;
  benchmark_dataset_version: string;
  total_queries: number;
  cache_hit_count: number;
  cache_hit_rate_percent: number;
  small_model_route_percent: number;
  large_model_route_percent: number;
  total_baseline_cost_usd: number;
  total_cpilot_cost_usd: number;
  overall_cost_reduction_percent: number;
  avg_baseline_latency_ms: number;
  avg_cpilot_latency_ms: number;
  overall_latency_reduction_percent: number;
  citation_coverage_percent: number;
  is_authoritative_billing: boolean;
  items: BenchmarkResultItem[];
}


