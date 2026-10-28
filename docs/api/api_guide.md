# CachePilot API Developer Guide

This guide provides exhaustive documentation and executable `curl` examples for the CachePilot AI Gateway API.

---

## 1. Global Conventions & Headers

All API endpoints follow RESTful conventions. Standard headers include:

| Header | Required | Description | Example |
|---|---|---|---|
| `Content-Type` | Yes (for POST) | Format of request payload | `application/json` |
| `X-Request-ID` | Optional | Correlation ID. If omitted, gateway generates a UUID4. | `req-550e8400-e29b-41d4-a716` |
| `X-Tenant-ID` | Optional | Tenant identifier fallback if not in JSON body. | `tenant-alpha` |
| `X-Security-Scope` | Optional | Security scope boundary fallback if not in JSON body. | `engineering` |

> [!NOTE]
> All financial numbers reported by CachePilot (`estimated_cost_usd`, `avoided_cost_usd`) are strictly non-authoritative estimations for routing telemetry and budgeting analysis. All API responses set `"is_authoritative_billing": false`.

---

## 2. Health & Readiness Probes

### 2.1 Process Liveness Probe
- **Endpoint**: `GET /health/live`
- **Purpose**: Fast check if the FastAPI process is running. Used by Kubernetes/Docker liveness checks.

```bash
curl -X GET http://localhost:8000/health/live
```

**Response (200 OK)**:
```json
{
  "status": "alive",
  "version": "1.0.0"
}
```

---

### 2.2 Deep Readiness Probe
- **Endpoint**: `GET /health/ready`
- **Purpose**: Verifies that backing storage (PostgreSQL, pgvector, and Redis / In-memory fallback) are operational.

```bash
curl -X GET http://localhost:8000/health/ready
```

**Response (200 OK)**:
```json
{
  "status": "ready",
  "version": "1.0.0",
  "environment": "development",
  "dependencies": {
    "database": {
      "status": "healthy",
      "latency_ms": 1.45
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 0.82
    }
  }
}
```

---

## 3. Document Ingestion & Listing (RAG Pipeline)

### 3.1 Ingest Document
- **Endpoint**: `POST /api/v1/documents`
- **Purpose**: Chunks and embeds enterprise documentation into the scoped vector database.

```bash
curl -X POST http://localhost:8000/api/v1/documents \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-alpha",
    "security_scope": "engineering",
    "title": "Cache Key Design Specification",
    "content": "CachePilot uses SHA-256 hash keys formed by tenant ID, security scope, normalized query text, corpus version, and prompt version to guarantee 0% cross-tenant leakage.",
    "metadata": {
      "source": "wiki",
      "author": "Architecture Team"
    }
  }'
```

**Response (201 Created)**:
```json
{
  "document_id": "doc-d8908fbb",
  "chunks_created": 1,
  "status": "ingested",
  "tenant_id": "tenant-alpha",
  "security_scope": "engineering"
}
```

---

### 3.2 List Documents
- **Endpoint**: `GET /api/v1/documents?tenant_id=tenant-alpha&security_scope=engineering`
- **Purpose**: Retrieves all ingested documents belonging strictly to the specified tenant and scope.

```bash
curl -X GET "http://localhost:8000/api/v1/documents?tenant_id=tenant-alpha&security_scope=engineering"
```

**Response (200 OK)**:
```json
[
  {
    "document_id": "doc-d8908fbb",
    "title": "Cache Key Design Specification",
    "tenant_id": "tenant-alpha",
    "security_scope": "engineering",
    "created_at": "2026-10-28T10:00:00Z",
    "chunks_count": 1
  }
]
```

---

## 4. Grounded RAG Query with Telemetry

### 4.1 Execute Grounded Query
- **Endpoint**: `POST /api/v1/query`
- **Purpose**: Executes a query with dual-tier semantic cache inspection, cost-aware model routing, citation extraction, and non-authoritative cost/latency telemetry.

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-alpha",
    "security_scope": "engineering",
    "query": "How does CachePilot construct cache keys?",
    "bypass_cache": false,
    "top_k": 3
  }'
```

**Response (200 OK)**:
```json
{
  "answer": "CachePilot constructs cache keys using a SHA-256 hash of tenant_id, security_scope, normalized_query, embedding_model_version, corpus_version, prompt_version, and generation_params_hash.",
  "citations": [
    {
      "document_id": "doc-d8908fbb",
      "chunk_id": "chunk-0",
      "text": "CachePilot uses SHA-256 hash keys formed by tenant ID, security scope...",
      "score": 0.94
    }
  ],
  "telemetry": {
    "request_id": "req-9b8832a8",
    "cache_status": "HIT_EXACT",
    "route": "mock-fast-small",
    "route_reason": "LOW_COMPLEXITY_DIRECT",
    "latency_breakdown": {
      "cache_lookup_ms": 1.2,
      "retrieval_ms": 0.0,
      "generation_ms": 0.0,
      "total_ms": 1.2
    },
    "tokens": {
      "prompt_tokens": 0,
      "completion_tokens": 0,
      "total_tokens": 0
    },
    "estimated_cost_usd": 0.0,
    "is_authoritative_billing": false
  }
}
```

---

## 5. Scope-Aware Semantic Cache Operations

### 5.1 Inspect Cache Entries
- **Endpoint**: `GET /api/v1/cache/entries?tenant_id=tenant-alpha&security_scope=engineering`
- **Purpose**: Lists all active cached entries and their cosine vector keys.

```bash
curl -X GET "http://localhost:8000/api/v1/cache/entries?tenant_id=tenant-alpha&security_scope=engineering"
```

---

### 5.2 Invalidate Cache
- **Endpoint**: `POST /api/v1/cache/invalidate`
- **Purpose**: Flushes cache entries by tenant, security scope, or corpus version.

```bash
curl -X POST http://localhost:8000/api/v1/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-alpha",
    "security_scope": "engineering",
    "corpus_version": "v1.0"
  }'
```

**Response (200 OK)**:
```json
{
  "invalidated_count": 5,
  "tenant_id": "tenant-alpha",
  "security_scope": "engineering",
  "status": "purged"
}
```

---

## 6. Dynamic Complexity Router & Usage Ledger

### 6.1 Classify Query Complexity
- **Endpoint**: `POST /api/v1/router/classify`
- **Purpose**: Evaluates query complexity without executing inference.

```bash
curl -X POST http://localhost:8000/api/v1/router/classify \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Compare the performance and cost of PostgreSQL pgvector versus Redis across large datasets."
  }'
```

**Response (200 OK)**:
```json
{
  "query": "Compare the performance and cost of PostgreSQL pgvector versus Redis across large datasets.",
  "complexity_score": 0.85,
  "selected_model": "mock-reasoning-large",
  "route_reason": "REASONING_REQUIRED",
  "triggers_detected": ["comparative", "analytical"]
}
```

---

### 6.2 Retrieve Request Ledger
- **Endpoint**: `GET /api/v1/ledger/requests?limit=10&tenant_id=tenant-alpha`
- **Purpose**: Fetches historical request audit trails with complete latency breakdowns and token consumption.

```bash
curl -X GET "http://localhost:8000/api/v1/ledger/requests?limit=10&tenant_id=tenant-alpha"
```

---

### 6.3 Get Metrics Summary
- **Endpoint**: `GET /api/v1/metrics/summary?tenant_id=tenant-alpha`
- **Purpose**: Computes aggregate metrics including total requests, cache hit rate, avoided spend, and average latency.

```bash
curl -X GET "http://localhost:8000/api/v1/metrics/summary?tenant_id=tenant-alpha"
```

**Response (200 OK)**:
```json
{
  "total_requests": 142,
  "cache_hit_rate": 0.584,
  "exact_hits": 45,
  "semantic_hits": 38,
  "cache_misses": 59,
  "total_cost_usd": 0.0421,
  "avoided_cost_usd": 0.0583,
  "average_latency_ms": 68.4,
  "is_authoritative_billing": false
}
```

---

## 7. Quality Evaluation & Benchmark Engine

### 7.1 Run Standard Quality Benchmark
- **Endpoint**: `GET /api/v1/evaluation/benchmark`
- **Purpose**: Runs the reproducible `v1.0.0-enterprise-eval` suite comparing CachePilot against an un-cached, un-routed Baseline RAG pipeline.

```bash
curl -X GET http://localhost:8000/api/v1/evaluation/benchmark
```

**Response (200 OK)**:
```json
{
  "suite_name": "v1.0.0-enterprise-eval",
  "baseline": {
    "total_requests": 8,
    "total_cost_usd": 0.040,
    "avg_latency_ms": 420.0,
    "citation_coverage": 1.0,
    "is_authoritative_billing": false
  },
  "cachepilot": {
    "total_requests": 8,
    "total_cost_usd": 0.021,
    "avg_latency_ms": 265.0,
    "citation_coverage": 1.0,
    "is_authoritative_billing": false
  },
  "delta": {
    "cost_reduction_pct": 47.5,
    "latency_reduction_pct": 36.9,
    "citation_parity": true
  }
}
```

---

## 8. Client Rate Limiting & HTTP 429

CachePilot applies a strict sliding-window token bucket limiter (default: 120 req/min per IP/Tenant):
- When exceeded, returns HTTP `429 Too Many Requests`.
- Includes response header: `Retry-After: 60`.

**Error Response (429 Too Many Requests)**:
```json
{
  "detail": "Rate limit exceeded. Maximum 120 requests per minute allowed.",
  "retry_after_seconds": 60
}
```
