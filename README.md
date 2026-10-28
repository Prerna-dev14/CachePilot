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

## 2. Phase 0 & Phase 1 Implemented Foundation

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
4. **Replaceable Provider Adapters**:
   - `LLMProvider` and `EmbeddingProvider` abstract interfaces.
   - Deterministic `MockLLMProvider` and `MockEmbeddingProvider` for CI tests.
   - Unit-normalized 1536-dimensional embeddings for cosine similarity evaluation.
5. **Database Schema & Migrations**:
   - Initial migration [`migrations/init.sql`](./migrations/init.sql) defining `tenants`, `users`, `documents`, `chunks`, `cache_entries`, `requests`, `model_usage`, `routing_policies`, `evaluation_runs`, and `evaluation_results`.
   - HNSW index support for cosine vector distance.
6. **Frontend Shell (React 19 + TypeScript + Vite + Tailwind CSS)**:
   - Responsive dark glassmorphism dashboard shell.
   - Real-time probe indicators with latency telemetry.
   - Tenant scope selector and phase navigation.

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

# 3. Copy sample environment file
cp .env.example .env

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

### Docker Compose
```bash
docker compose up -d
```
- Frontend UI: `http://localhost:5173`
- Backend API Docs: `http://localhost:8000/docs`
- Health Liveness: `http://localhost:8000/health/live`
- Health Readiness: `http://localhost:8000/health/ready`

---

## 4. Test Results Summary

- **Backend Pytest Suite**: 13 passed (100%)
  - `backend/tests/unit/test_config.py` (Validation, threshold bounds, secret masking)
  - `backend/tests/unit/test_logging.py` (Correlation ID context, JSON formatting)
  - `backend/tests/unit/test_mock_providers.py` (Deterministic generation, failure simulation, vector normalization)
  - `backend/tests/integration/test_health_api.py` (Liveness, readiness, custom correlation headers)
- **Frontend Vitest Suite**: 5 passed (100%)
  - `Header.test.tsx` (Brand rendering, active phase badge, tenant switching)
  - `SystemHealthCard.test.tsx` (Dependency probe states, error notification, refresh button)
- **Frontend Production Build**: Clean build via `tsc -b && vite build`.

---

## 5. Next Step: Phase 2 — Baseline RAG Pipeline
Upon approval, Phase 2 will implement:
- Document ingestion endpoint (`POST /api/v1/documents`)
- Text chunking, token estimation, and vector generation
- pgvector vector similarity retrieval
- Grounded generation with citations and source references
- Baseline end-to-end question answering pipeline
