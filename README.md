# CachePilot (CPilot)
### Semantic Caching & Cost-Aware Model Routing for Enterprise RAG

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/pgvector-Postgres_16-336791.svg)](https://github.com/pgvector/pgvector)
[![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

CachePilot is an observable, scope-aware AI gateway and reverse proxy designed to reduce redundant inference spend, dynamically route queries between small (fast) and large (reasoning) models, and provide real-time cost, latency, and quality telemetry for Retrieval-Augmented Generation (RAG) applications.

---

## 1. Primary Documentation & Artifacts
- **Architecture & System Flow Diagrams**: [`docs/architecture/architecture_diagram.md`](./docs/architecture/architecture_diagram.md)
- **API Developer Guide & Curl Recipes**: [`docs/api/api_guide.md`](./docs/api/api_guide.md)
- **Reproducible Benchmark Report**: [`docs/benchmark/reproducible_benchmark_report.md`](./docs/benchmark/reproducible_benchmark_report.md)
- **Operational Trade-offs & Limitations**: [`docs/operations/limitations_and_tradeoffs.md`](./docs/operations/limitations_and_tradeoffs.md)
- **Threat Model & Security Controls**: [`docs/threat-model/threat_model.md`](./docs/threat-model/threat_model.md)
- **Architecture Decisions (ADR-001)**: [`docs/architecture/ADR-001-architecture-decisions.md`](./docs/architecture/ADR-001-architecture-decisions.md)
- **Master Specification**: [`CachePilot_Master_Specification.docx`](./CachePilot_Master_Specification.docx)
- **Implementation Guide**: [`CachePilot_Implementation_Document.docx`](./CachePilot_Implementation_Document.docx)
- **Development Phase Plan**: [`CachePilot_Development_Plan.docx`](./CachePilot_Development_Plan.docx)

---

## 2. Core Architecture & Differentiating Capabilities

### 2.1 Scope-Aware Semantic Cache Key Formulation
CachePilot strictly prevents cross-tenant and cross-scope data contamination. Every cache key is uniquely computed via:
```
cache_key = SHA256(
    tenant_id + ":" +
    security_scope + ":" +
    normalized_query + ":" +
    embedding_model_version + ":" +
    corpus_version + ":" +
    prompt_version + ":" +
    generation_params_hash
)
```
- **Zero Cross-Tenant Leakage**: Cache entries and vector embeddings are physically and logically segregated with `WHERE tenant_id = :tenant_id AND security_scope = :security_scope`.
- **Adversarial Hardening**: Defends against scope delimiter collisions, control characters, null bytes (`\x00`), and semantic polarity inversions.

### 2.2 Dual-Tier Caching Hierarchy
1. **Tier 1 (Exact Match)**: Sub-2ms hash lookup in Redis (with offline in-memory fallback) using SHA-256 keys.
2. **Tier 2 (Semantic Cosine Search)**: High-dimensional vector search in PostgreSQL `pgvector` utilizing an HNSW cosine index.
3. **Conservative Cosine Threshold ($\tau = 0.88$)**: Guarantees that only strictly relevant answers are reused, preventing semantic drift.

### 2.3 Cost-Aware Dynamic Routing & Fallback
- **Multi-Signal Complexity Scoring**: Evaluates query length, structural tokens, and comparative (`vs`, `difference`), analytical (`why`, `explain`), and quantitative (`calculate`, `sum`, `audit`) triggers.
- **Dynamic Model Selection**:
  - Score $< 0.65$: Routed to `mock-fast-small` (`LOW_COMPLEXITY_DIRECT`) at \$0.0005 / 1k tokens.
  - Score $\ge 0.65$: Routed to `mock-reasoning-large` (`REASONING_REQUIRED`) at \$0.0050 / 1k tokens.
- **Deterministic Fallback**: If the small model experiences an upstream timeout or 5xx failure, the query automatically re-routes to the large model with reason `FALLBACK_RETRY`.

### 2.4 Observable Telemetry & Non-Authoritative Ledger
- Every response provides a transparent latency waterfall breakdown (`cache_lookup_ms`, `retrieval_ms`, `generation_ms`, `total_ms`).
- Incurred spend and avoided savings are tracked non-authoritatively with `"is_authoritative_billing": false`.

### 2.5 Ingress Protection & Rate Limiting
- Token-bucket sliding window client rate limiter (default: 120 req/min per IP/Tenant).
- Returns HTTP `429 Too Many Requests` with standard `Retry-After: 60` headers.

---

## 3. Quickstart: Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+ & npm

### Backend Setup
```bash
# 1. Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux/macOS

# 2. Install dependencies
pip install -r backend/requirements-dev.txt

# 3. Seed sample enterprise documents
python scripts/seed_sample_data.py

# 4. Start development backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start frontend dev server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Quickstart: Docker Compose Deployment

CachePilot provides a complete multi-container production stack (PostgreSQL with `pgvector`, Redis cache storage, FastAPI backend, and Nginx-served React SPA):

```bash
# Build and run the complete stack
docker compose up --build -d

# Check service logs
docker compose logs -f

# Verify service health
curl -X GET http://localhost:8000/health/ready
```

| Service | Container Name | Port Mapping | Description |
|---|---|---|---|
| `postgres` | `cachepilot-postgres` | `5432:5432` | PostgreSQL 16 + pgvector HNSW index |
| `redis` | `cachepilot-redis` | `6379:6379` | Redis 7 Tier 1 exact cache |
| `backend` | `cachepilot-backend` | `8000:8000` | FastAPI gateway & router engine |
| `frontend` | `cachepilot-frontend` | `5173:80` | React 19 + Vite SPA served via Nginx |

---

## 5. Automated Verification & Testing

### 5.1 End-to-End Smoke Test
Verify the entire vertical slice with a single command:
```bash
python scripts/smoke_test.py
```
This runs an automated 8-step smoke test validating:
1. Process Liveness (`GET /health/live`)
2. Deep Readiness (`GET /health/ready`)
3. Document Ingestion (`POST /api/v1/documents`)
4. Low Complexity Query Routing to Small Model (`POST /api/v1/query`)
5. Tier 1 Exact Cache Match on Repeat (`POST /api/v1/query`)
6. High Complexity Routing to Reasoning Model (`POST /api/v1/query`)
7. Tier 2 Semantic Cosine Match (`POST /api/v1/query`)
8. Summary Metrics & Reproducible Benchmark (`GET /api/v1/evaluation/benchmark`)

### 5.2 Backend Pytest Suite (47 Tests, 100% Pass)
```bash
pytest -v
```
- `backend/tests/security/test_adversarial_cache.py`: Scope collision defense, null bytes, antonym separation, and prompt injection rejection.
- `backend/tests/integration/test_rate_limiting.py`: 120 req/min token bucket, Retry-After headers, health check bypass.
- `backend/tests/unit/test_secrets_handling.py`: Pydantic `SecretStr` masking and `safe_dump()` credential exclusion.
- `backend/tests/unit/test_evaluation_benchmark.py`: Baseline vs. CachePilot delta assertions.
- `backend/tests/integration/test_evaluation_api.py`: Benchmark runner and audit endpoints.
- `backend/tests/security/test_cache_isolation.py`: Zero cross-tenant cache contamination.
- `backend/tests/security/test_tenant_isolation.py`: Zero cross-tenant document retrieval.
- `backend/tests/unit/test_complexity_classifier.py`: Structural and multi-signal routing triggers.
- `backend/tests/unit/test_routing_fallback.py`: Deterministic fallback on provider failure.
- `backend/tests/integration/test_usage_ledger_api.py`: Ledger recording and metrics aggregation.
- `backend/tests/unit/test_cache_freshness.py`: TTL expiration and corpus version purging.
- `backend/tests/unit/test_cache_key.py`: SHA-256 key normalization.
- `backend/tests/integration/test_semantic_cache_api.py`: Exact and semantic cache operations.
- `backend/tests/integration/test_rag_pipeline.py`: Ingestion, chunking, retrieval, and citations.

### 5.3 Frontend Vitest Suite (16 Tests, 100% Pass)
```bash
cd frontend
npm run test
npm run build
```
- `EvaluationHardeningStudio.test.tsx`: Live security control probes and operational tradeoffs display.
- `TelemetryDashboard.test.tsx`: KPI cards, model routing mix, cache mix, waterfall profile, benchmark comparison matrix, and audit export.
- `RoutingLedgerStudio.test.tsx`: Complexity simulator, historical ledger records, and diagnostics modal.
- `SemanticCacheExplorer.test.tsx`: Hit rate metrics, entry inspection, and cache purge trigger.
- `RAGStudio.test.tsx`: Ingestion form, preset queries, and citation cards.
- `Header.test.tsx` & `SystemHealthCard.test.tsx`.

---

## 6. Implementation Phase Traceability

| Phase | Milestone | Key Deliverables | Status |
|---|---|---|---|
| **Phase 0 & 1** | Foundation & Architecture | ADR-001, Threat Model, API Contract, Pydantic Config, Health Probes, Provider Adapters, DB Schema | Verified & Committed (`241df8f`) |
| **Phase 2** | Baseline Grounded RAG | Text Chunking, Ingestion, Citations, Scoped Retrieval, RAG Studio UI, Zero-Leakage Security Tests | Verified & Committed (`145c86e`) |
| **Phase 3** | Dual-Tier Semantic Cache | SHA-256 Key Generator, Dual-Tier Cache Repository, Invalidation API, Explorer UI, Isolation Tests | Verified & Committed (`be8c522`) |
| **Phase 4** | Cost-Aware Model Router | Complexity Classifier, Routing Fallback, Usage Ledger API, Routing Studio UI, Unit/Integration Tests | Verified & Committed (`f71489c`) |
| **Phase 5** | Telemetry & Quality Benchmark | Metrics Aggregator, `v1.0.0-enterprise-eval` Benchmark, Telemetry Dashboard UI, Audit Export | Verified & Committed (`9e5f2dc`) |
| **Phase 6** | Hardening & Security Audit | Rate Limiter (120 req/min), Adversarial Cache Tests, SecretStr Masking, Trade-offs Docs, Audit Studio UI | Verified & Committed (`502a2f7`) |
| **Phase 7** | Packaging & Release Candidate | Docker Compose, Dockerfiles, Nginx Conf, Smoke Test Script, System Diagrams, API User Guide | **Complete** |

---

## 7. License

MIT License. See [LICENSE](LICENSE) for details.
