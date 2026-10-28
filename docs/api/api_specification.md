# CachePilot REST API Specification

## Protocol Baseline
- Base URL: `http://localhost:8000`
- Response Envelopes: Consistent JSON envelopes with status, data, and error details.
- Correlation Header: `X-Request-ID` returned on every response.
- Version: `v1`

---

## 1. System & Health Endpoints

### `GET /health/live`
Process liveness probe. Indicates if the application process is running.
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "service": "cachepilot",
  "version": "1.0.0",
  "timestamp": "2026-10-28T12:00:00Z"
}
```

### `GET /health/ready`
Dependency readiness probe. Verifies database and cache connectivity.
- **Response `200 OK` (All healthy)**:
```json
{
  "status": "ready",
  "dependencies": {
    "database": {"status": "connected", "latency_ms": 1.2},
    "redis": {"status": "connected", "latency_ms": 0.8}
  },
  "timestamp": "2026-10-28T12:00:00Z"
}
```
- **Response `503 Service Unavailable`** (Degraded dependency):
```json
{
  "status": "unhealthy",
  "dependencies": {
    "database": {"status": "error", "error": "connection refused"},
    "redis": {"status": "connected", "latency_ms": 0.8}
  },
  "timestamp": "2026-10-28T12:00:00Z"
}
```

---

## 2. Query & Ingestion Endpoints (Phase 2 - 4)

### `POST /api/v1/query`
Run retrieval and answer generation with semantic cache check and model routing.
- **Request Body**:
```json
{
  "query": "What is the data retention policy?",
  "tenant_id": "tenant-default",
  "security_scope": "public",
  "bypass_cache": false,
  "similarity_threshold": 0.88,
  "conversation_id": "conv-123"
}
```
- **Response `200 OK`**:
```json
{
  "request_id": "req-98f23",
  "answer": "Data is retained for 30 days...",
  "citations": [
    {"document_id": "doc-1", "chunk_id": "chunk-10", "score": 0.92, "text_snippet": "..."}
  ],
  "telemetry": {
    "cache_status": "HIT_SEMANTIC",
    "similarity_score": 0.912,
    "route": "small",
    "route_reason": "SEMANTIC_CACHE_HIT",
    "tokens": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    "estimated_cost_usd": 0.0,
    "is_authoritative_billing": false,
    "latencies_ms": {"cache_lookup": 14.2, "retrieval": 0, "generation": 0, "total": 14.2}
  }
}
```

### `POST /api/v1/documents`
Ingest document content, compute chunk embeddings, and update corpus version.

### `GET /api/v1/metrics/summary`
Aggregated dashboard metrics: cache hit rate, p50/p95 latency, total estimated cost, model distribution.
