-- CachePilot Initial Database Schema & Extensions
-- Supports PostgreSQL with pgvector extension

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    security_scope VARCHAR(64) NOT NULL DEFAULT 'default',
    corpus_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0',
    title VARCHAR(512) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks with Vector Embeddings
CREATE TABLE IF NOT EXISTS chunks (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    security_scope VARCHAR(64) NOT NULL DEFAULT 'default',
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding vector(1536),
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Semantic Cache Entries
CREATE TABLE IF NOT EXISTS cache_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    security_scope VARCHAR(64) NOT NULL DEFAULT 'default',
    cache_key VARCHAR(128) NOT NULL,
    query_text TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    query_embedding vector(1536),
    response_text TEXT NOT NULL,
    citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    embedding_model_version VARCHAR(64) NOT NULL,
    corpus_version VARCHAR(32) NOT NULL,
    prompt_version VARCHAR(32) NOT NULL,
    generation_params_hash VARCHAR(64) NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 86400,
    expires_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Requests Telemetry Ledger
CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    security_scope VARCHAR(64) NOT NULL DEFAULT 'default',
    query_text TEXT NOT NULL,
    cache_status VARCHAR(32) NOT NULL, -- HIT_EXACT, HIT_SEMANTIC, MISS, BYPASS
    route VARCHAR(32) NOT NULL,        -- small, large, cache
    route_reason VARCHAR(128) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    is_authoritative_billing BOOLEAN NOT NULL DEFAULT FALSE,
    latency_cache_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    latency_retrieval_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    latency_generation_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    latency_total_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    error_code VARCHAR(64),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-model Execution Usage Breakdown
CREATE TABLE IF NOT EXISTS model_usage (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(128) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    provider_name VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    unit_cost_input NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    unit_cost_output NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.0,
    latency_ms NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Routing Policies
CREATE TABLE IF NOT EXISTS routing_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    complexity_threshold NUMERIC(4, 3) NOT NULL DEFAULT 0.650,
    small_model_name VARCHAR(128) NOT NULL,
    large_model_name VARCHAR(128) NOT NULL,
    rules_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Evaluation Runs & Results
CREATE TABLE IF NOT EXISTS evaluation_runs (
    id VARCHAR(64) PRIMARY KEY,
    run_name VARCHAR(128) NOT NULL,
    dataset_name VARCHAR(128) NOT NULL,
    dataset_version VARCHAR(32) NOT NULL,
    baseline_variant VARCHAR(64) NOT NULL,
    evaluated_variant VARCHAR(64) NOT NULL,
    summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evaluation_results (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    expected_answer TEXT,
    actual_answer TEXT NOT NULL,
    relevance_score NUMERIC(4, 3),
    faithfulness_score NUMERIC(4, 3),
    answer_similarity_score NUMERIC(4, 3),
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    latency_ms NUMERIC(10, 2) NOT NULL,
    estimated_cost_usd NUMERIC(10, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Security Partition Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_scope ON chunks (tenant_id, security_scope);
CREATE INDEX IF NOT EXISTS idx_cache_scope_key ON cache_entries (tenant_id, security_scope, cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries (expires_at);
CREATE INDEX IF NOT EXISTS idx_requests_correlation ON requests (request_id);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_created ON requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_req ON model_usage (request_id);

-- Vector Indexes (HNSW for Cosine Distance)
CREATE INDEX IF NOT EXISTS idx_chunks_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_cache_hnsw ON cache_entries USING hnsw (query_embedding vector_cosine_ops);

-- Default Seed Tenant
INSERT INTO tenants (id, name) VALUES ('tenant-default', 'Default Tenant') ON CONFLICT (id) DO NOTHING;
INSERT INTO routing_policies (id, tenant_id, name, is_active, complexity_threshold, small_model_name, large_model_name)
VALUES ('policy-default', 'tenant-default', 'Default Cost Router Policy', TRUE, 0.650, 'mock-fast-small', 'mock-reasoning-large')
ON CONFLICT (id) DO NOTHING;
