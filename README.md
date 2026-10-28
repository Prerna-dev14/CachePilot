# CachePilot (CPilot)
### Semantic Caching & Cost-Aware Model Routing for RAG

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/pgvector-Postgres_16-336791.svg)](https://github.com/pgvector/pgvector)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

CachePilot is an observable, scope-aware AI gateway designed to reduce redundant inference spend, dynamically route queries between small (fast) and large (reasoning) models, and provide real-time cost, latency, and quality telemetry.

---

## 1. Primary Sources of Truth & Documentation
- **Master Specification**: [`CachePilot_Master_Specification.docx`](./CachePilot_Master_Specification.docx)
- **Implementation Guide**: [`CachePilot_Implementation_Document.docx`](./CachePilot_Implementation_Document.docx)
- **Development Phase Plan**: [`CachePilot_Development_Plan.docx`](./CachePilot_Development_Plan.docx)
- **Architecture Decisions**: [`docs/architecture/ADR-001-architecture-decisions.md`](./docs/architecture/ADR-001-architecture-decisions.md)
- **Threat Model & Security Controls**: [`docs/threat-model/threat_model.md`](./docs/threat-model/threat_model.md)
- **API Baseline Specification**: [`docs/api/api_specification.md`](./docs/api/api_specification.md)

---

## 2. Implemented Foundation (Phase 0, 1, 2 & 3)

### Scope-Aware Semantic Cache Key Formulation
Cache keys strictly enforce multi-tenant isolation and security scope boundaries:
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

### Core Architecture Components
1. **FastAPI Gateway with Contextual Correlation IDs**:
   - Every request assigns or propagates an `X-Request-ID` correlation token.
   - Non-sensitive structured logging without secrets.
2. **Configuration Validation (`Pydantic Settings`)**:
   - Environment variables loaded safely from `.env` or system environment.
   - Sensitive credentials protected by `SecretStr`.
   - `safe_dump()` method masks passwords and connection strings.
3. **Health & Readiness Probes**:
   - `GET /health/live`: Fast process liveness probe (200 OK).
   - `GET /health/ready`: Deep dependency readiness check measuring roundtrip latency for PostgreSQL (`pgvector`) and Redis cache storage (with automatic in-memory fallback).
4. **Baseline RAG Pipeline**:
   - `POST /api/v1/documents`: Document ingestion with automatic text chunking and 1536-d vector embeddings.
   - `GET /api/v1/documents`: Scoped corpus document listing strictly filtered by tenant.
   - `POST /api/v1/query`: Grounded query execution with vector similarity retrieval, citation tracking, token counting, estimated cost calculation, and latency breakdown (retrieval vs generation).
5. **Scope-Aware Semantic Cache (Phase 3 Slice)**:
   - **Dual-Tier Cache**: Fast exact hash match in Redis / In-Memory (Tier 1) + Cosine similarity candidate retrieval in pgvector (Tier 2).
   - **Similarity Threshold ($\tau = 0.88$)**: Conservative default prevents semantic drift and hallucinations.
   - **Freshness & TTL**: Enforces time-based expiration and invalidates stale entries on corpus version or prompt template updates.
   - **Cache Invalidation**: `POST /api/v1/cache/invalidate` purges entries by tenant, scope, or corpus version.
   - **Cache Telemetry**: `GET /api/v1/cache/metrics` and `GET /api/v1/cache/entries`.
6. **Multi-Tenant Security Isolation**:
   - Hard boundary tests verify that neither vector chunks nor cached query responses can ever leak across tenants or security boundaries.
7. **Replaceable Provider Adapters**:
   - `LLMProvider` and `EmbeddingProvider` abstract interfaces.
   - Deterministic `MockLLMProvider` and `MockEmbeddingProvider` with semantic keyword overlap simulation for CI tests.
8. **Frontend RAG Studio & Semantic Cache Explorer (React 19 + TypeScript + Vite + Tailwind CSS)**:
   - Interactive RAG Query & Ingestion Studio with evidence citations and telemetry.
   - Semantic Cache Explorer displaying hit rate metrics, dual-tier match counters, cache entry inspector, purge controls, and cosine threshold sensitivity simulator.

---

## 3. Quickstart & Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ & npm
- Docker & Docker Compose (Optional for local containerized Postgres/Redis)

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

# 4. Run automated test suite
pytest -v

# 5. Start development backend server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Run test suite
npm run test

# 3. Build production bundle
npm run build

# 4. Start frontend dev server
npm run dev
```

---

## 4. Test Results Summary

- **Backend Pytest Suite**: 47 passed (100%)
  - `backend/tests/security/test_adversarial_cache.py` (Scope delimiter collisions, control characters & null bytes, antonym polarity, boundary length rejection, prompt injection)
  - `backend/tests/integration/test_rate_limiting.py` (120 req/min token bucket, Retry-After header, health probe exemption)
  - `backend/tests/unit/test_secrets_handling.py` (SecretStr masking, safe_dump exclusion, health config sanitization)
  - `backend/tests/unit/test_evaluation_benchmark.py` (Fixed benchmark suite comparison: cost & latency reductions, citation integrity, non-authoritative flag)
  - `backend/tests/integration/test_evaluation_api.py` (GET benchmark comparison & POST live benchmark execution endpoints)
  - `backend/tests/security/test_cache_isolation.py` (Zero cross-tenant cache reuse leakage)
  - `backend/tests/security/test_tenant_isolation.py` (Zero cross-tenant retrieval leakage)
  - `backend/tests/unit/test_complexity_classifier.py` (Low complexity factual lookup, comparative reasoning, multi-step analytical reasoning, quantitative math)
  - `backend/tests/unit/test_routing_fallback.py` (Deterministic small model error recovery to large model with `FALLBACK_RETRY`)
  - `backend/tests/integration/test_usage_ledger_api.py` (Classifier API, usage ledger ingestion, request drilldown, summary metrics)
  - `backend/tests/unit/test_cache_freshness.py` (TTL expiration and corpus version invalidation)
  - `backend/tests/unit/test_cache_key.py` (Query normalization, tenant isolation, and version sensitivity)
  - `backend/tests/integration/test_semantic_cache_api.py` (Exact hit, semantic hit, miss, bypass, and invalidation)
  - `backend/tests/integration/test_rag_pipeline.py` (End-to-end ingestion, document listing, grounded queries)
  - `backend/tests/unit/test_chunking.py`, `test_config.py`, `test_logging.py`, `test_mock_providers.py`, `test_health_api.py`.
- **Frontend Vitest Suite**: 16 passed (100%)
  - `EvaluationHardeningStudio.test.tsx` (Security controls verification, re-audit trigger, operational tradeoffs matrix)
  - `TelemetryDashboard.test.tsx` (Hero KPI cards, model routing mix, cache mix, waterfall profile, benchmark comparison matrix, export audit JSON)
  - `RoutingLedgerStudio.test.tsx` (Summary KPI cards, complexity simulator, historical ledger records, diagnostics modal)
  - `SemanticCacheExplorer.test.tsx` (Hit rate metrics, entry inspection, cache purge trigger)
  - `RAGStudio.test.tsx` (Ingestion form, preset buttons, grounded query execution with citations)
  - `Header.test.tsx` & `SystemHealthCard.test.tsx`.
- **Frontend Production Build**: Clean bundle via `tsc -b && vite build`.

---

## 5. Next Step: Phase 7 — Packaging & Release Readiness
Upon approval, Phase 7 will implement:
- Standalone Docker Compose multi-service verification with volume bindings
- Complete `.env.example` and environment configuration guide
- End-to-end smoke test script and API user guide
- Release candidate checklist verification



