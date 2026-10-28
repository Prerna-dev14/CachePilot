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

## 2. Implemented Foundation (Phase 0, 1 & 2)

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
4. **Baseline RAG Pipeline (Phase 2 Slice)**:
   - `POST /api/v1/documents`: Document ingestion with automatic text chunking and 1536-d vector embeddings.
   - `GET /api/v1/documents`: Scoped corpus document listing strictly filtered by tenant.
   - `POST /api/v1/query`: Grounded query execution with vector similarity retrieval, citation tracking, token counting, estimated cost calculation, and latency breakdown (retrieval vs generation).
5. **Security & Scope Isolation**:
   - Hard boundary tests verify Tenant A cannot retrieve Tenant B's documents even when queries match confidential text.
6. **Replaceable Provider Adapters**:
   - `LLMProvider` and `EmbeddingProvider` abstract interfaces.
   - Deterministic `MockLLMProvider` and `MockEmbeddingProvider` with semantic keyword overlap simulation for CI tests.
7. **Database Schema & Migrations**:
   - Initial migration [`migrations/init.sql`](./migrations/init.sql) defining complete multi-tenant RAG schema.
8. **Frontend RAG Studio (React 19 + TypeScript + Vite + Tailwind CSS)**:
   - Interactive Document Ingestion panel with preset templates.
   - Live Corpus document browser.
   - Grounded RAG Query console with top-k controls, evidence citations, and telemetry waterfall.

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

- **Backend Pytest Suite**: 19 passed (100%)
  - `backend/tests/security/test_tenant_isolation.py` (Zero cross-tenant retrieval leakage)
  - `backend/tests/unit/test_chunking.py` (Chunk size, overlap, empty/short edge cases, token estimation)
  - `backend/tests/integration/test_rag_pipeline.py` (End-to-end ingest, list, and grounded query flow)
  - `backend/tests/unit/test_config.py` (Validation, threshold bounds, secret masking)
  - `backend/tests/unit/test_logging.py` (Correlation ID context, JSON formatting)
  - `backend/tests/unit/test_mock_providers.py` (Deterministic generation, failure simulation, vector normalization)
  - `backend/tests/integration/test_health_api.py` (Liveness, readiness, custom correlation headers)
- **Frontend Vitest Suite**: 8 passed (100%)
  - `RAGStudio.test.tsx` (Ingestion form, preset buttons, grounded query execution with citations)
  - `Header.test.tsx` (Brand rendering, active phase badge, tenant switching)
  - `SystemHealthCard.test.tsx` (Dependency probe states, error notification, refresh button)
- **Frontend Production Build**: Clean build via `tsc -b && vite build`.

---

## 5. Next Step: Phase 3 — Semantic Cache
Upon approval, Phase 3 will implement:
- Scope-aware cache key computation
- Dual-tier lookup (Redis / in-memory exact match + pgvector similarity candidate retrieval)
- Configurable similarity threshold ($\tau = 0.88$)
- Cache write with TTL and freshness tags (`corpus_version`, `prompt_version`)
- Cache bypass, explicit invalidation endpoint (`POST /api/v1/cache/invalidate`), and hit/miss telemetry tracking
