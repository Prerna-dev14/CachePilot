# Architecture Decision Record (ADR-001)
## CachePilot System Architecture & Design Foundation

- **Status**: Approved
- **Date**: 2026-10-28
- **Primary Source of Truth**: CachePilot_Master_Specification.docx
- **Implementation Guide**: CachePilot_Implementation_Document.docx
- **Delivery Sequence**: CachePilot_Development_Plan.docx

---

### 1. Context and Problem Statement
Retrieval-Augmented Generation (RAG) systems frequently suffer from high operating costs due to redundant queries, inefficient routing to expensive frontier models for trivial questions, and lack of observability over cache accuracy. CachePilot is an observable, scope-aware RAG gateway that introduces:
1. **Scope-Aware Semantic Caching**: Multi-tenant exact and vector similarity caching with TTL, corpus/prompt/model version invalidation, and bypass controls.
2. **Cost-Aware Model Routing**: Dynamic routing between small (fast/cost-effective) and large (reasoning-intensive) models with transparent, recorded routing rationales.
3. **Usage Ledger & Quality Telemetry**: Per-request metrics for tokens, estimated cost (explicitly labeled non-authoritative), latencies, and evaluation scores.

---

### 2. Architecture Overview & Components

CachePilot uses a cleanly decoupled layered architecture:

```
[ Frontend: React + TypeScript + Vite + Tailwind ]
                       │
             HTTP / REST (JSON API)
                       │
[ FastAPI Gateway & Middleware Layer ]
   ├── Request Correlation ID Middleware (X-Request-ID)
   ├── Rate Limiting & Input Validation (Pydantic v2)
   └── Structured Contextual Logger
                       │
[ Service & Pipeline Layer ]
   ├── Semantic Cache Service (Key Generator, Scoped Lookup, Invalidation)
   ├── Routing Service (Complexity Analyzer, Policy Selector, Fallback Engine)
   ├── RAG Orchestration Service (Ingestion, Chunking, Retrieval, Generation)
   └── Usage Ledger & Telemetry Service (Metrics, Cost Estimator)
                       │
[ Provider Adapters (Replaceable Interfaces) ]
   ├── LLMProvider Interface (MockLLM, OpenAI, Anthropic, Ollama)
   └── EmbeddingProvider Interface (MockEmbedding, OpenAI, Local)
                       │
[ Persistence & Cache Layer ]
   ├── PostgreSQL + pgvector (Documents, Chunks, Cache Embeddings, Telemetry Ledger)
   └── Redis / In-Memory KV (Fast Exact Cache, Rate Limiting, TTL)
```

---

### 3. Key Design Decisions

#### Decision 1: Scope-Aware Semantic Cache Key Formulation
Cache entries must never be reused across incompatible authorization scopes. A cache key is deterministically generated from:
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
- **Semantic Candidate Retrieval**: Vectors are searched using cosine distance (`pgvector`), strictly bounded by `tenant_id` and `security_scope`.
- **Threshold Policy**: Default conservative cosine similarity threshold (default `0.88`). If similarity `< threshold`, it is a cache miss.

#### Decision 2: Cost-Aware Routing Policy
- Requests are analyzed across:
  - Query length, lexical and syntactical complexity.
  - Multi-step reasoning requirements (e.g. comparative questions, mathematical indicators).
  - Context size and latency budget.
- The router emits:
  - Selected Model: `small` (e.g. fast model) or `large` (frontier model).
  - Explicit Route Reason Code (e.g., `LOW_COMPLEXITY_DIRECT`, `REASONING_REQUIRED`, `FALLBACK_RETRY`).
- **Resilient Fallback**: If small model execution fails or confidence is below threshold, the system safely falls back to the large model with logged reason `FALLBACK_RETRY`.

#### Decision 3: Non-Authoritative Cost Estimation
- Costs are calculated using transparent, configurable unit rates (per 1,000 input/output tokens).
- The API explicitly labels all financial metrics as `estimated_cost_usd` with `cost_currency: "USD"` and `is_authoritative_billing: false`.

#### Decision 4: Replaceable Provider Pattern with Deterministic CI Mocks
- LLM and Embedding providers inherit from abstract base classes (`LLMProvider`, `EmbeddingProvider`).
- Default setup includes `MockLLMProvider` and `MockEmbeddingProvider` generating deterministic outputs and embeddings for fast, reproducible, offline tests.
