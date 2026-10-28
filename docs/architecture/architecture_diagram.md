# CachePilot Architecture & Workflow Diagrams

This document outlines the architecture, component interaction flow, cache decision engine, and dynamic model routing decision tree for **CachePilot (CPilot)**.

---

## 1. System Architecture & Topology

CachePilot sits as a reverse proxy / AI gateway between frontend client applications and backing model providers or vector databases.

```mermaid
graph TB
    subgraph Client Tier
        UI["React 19 + TypeScript SPA (Vite / Tailwind)"]
        CLI["API Clients / Automated Pipelines"]
    end

    subgraph Security & Ingress Tier
        RL["Client Rate Limiter (120 req/min Token Bucket)"]
        AuthCtx["Security Scope & Tenant Context Enforcer"]
    end

    subgraph FastAPI Gateway Engine
        RouterEngine["Cost-Aware Dynamic Router"]
        CacheEngine["Scope-Aware Dual-Tier Semantic Cache"]
        RAGPipeline["Grounded RAG Pipeline & Citation Engine"]
        LedgerService["Usage Ledger & Telemetry Service"]
    end

    subgraph Storage & Indexing Tier
        RedisCache[("Redis / In-Memory Tier-1 Exact Match")]
        PGVector[("PostgreSQL 16 + pgvector HNSW Tier-2 Semantic Store")]
        RelationalDB[("PostgreSQL Document & Usage Ledger Store")]
    end

    subgraph Model Provider Adapters
        FastSmall["Fast Small Model (mock-fast-small / gpt-4o-mini)"]
        ReasoningLarge["Reasoning Large Model (mock-reasoning-large / gpt-4o)"]
        Embedder["Embedding Provider (mock-embedding-v1 / text-embedding-3-small)"]
    end

    UI --> RL
    CLI --> RL
    RL --> AuthCtx
    AuthCtx --> CacheEngine
    
    CacheEngine -->|Tier 1 Exact Match SHA-256| RedisCache
    CacheEngine -->|Tier 2 Cosine Search tau >= 0.88| PGVector
    
    CacheEngine -->|Cache Miss| RouterEngine
    RouterEngine --> RAGPipeline
    
    RAGPipeline --> Embedder
    RAGPipeline --> PGVector
    RAGPipeline --> FastSmall
    RAGPipeline --> ReasoningLarge
    
    FastSmall -.->|Fallback on Failure| ReasoningLarge
    
    RAGPipeline --> CacheEngine
    RAGPipeline --> LedgerService
    LedgerService --> RelationalDB
```

---

## 2. Dual-Tier Semantic Caching Sequence & Decision Engine

CachePilot employs a deterministic, zero-cross-tenant cache strategy. Every incoming query passes through query normalization and scope isolation before any cache lookup or vector distance calculation is performed.

```mermaid
sequenceDiagram
    autonumber
    actor Client as API Client / UI
    participant GW as FastAPI Gateway
    participant Key as Cache Key Generator
    participant T1 as Tier 1: Exact Match (Redis)
    participant T2 as Tier 2: Semantic (pgvector HNSW)
    participant RAG as RAG Pipeline / LLM
    participant Ledger as Telemetry Ledger

    Client->>GW: POST /api/v1/query {tenant_id, security_scope, query, ...}
    GW->>Key: Normalize Query & Generate SHA-256 Key
    Note over Key: Normalizes whitespace, strips control chars,<br/>binds tenant_id, security_scope, corpus_version
    
    GW->>T1: Check Exact Match (Key)
    alt Tier 1 Hit
        T1-->>GW: Cached Payload (Status: HIT_EXACT)
        GW->>Ledger: Record Audit (0 tokens, $0.00 avoided cost)
        GW-->>Client: Return Cached Response (waterfall: ~2ms)
    else Tier 1 Miss
        GW->>T2: Vector Cosine Search (pgvector cosine_distance <= 0.12)
        Note over T2: WHERE tenant_id = :tenant_id<br/>AND security_scope = :scope<br/>AND similarity >= 0.88
        alt Tier 2 Hit (similarity >= 0.88)
            T2-->>GW: Semantic Cached Payload (Status: HIT_SEMANTIC)
            GW->>T1: Populate Tier 1 Key for Future Queries
            GW->>Ledger: Record Audit (0 tokens, avoided cost)
            GW-->>Client: Return Cached Response (waterfall: ~15ms)
        else Tier 2 Miss (similarity < 0.88 or empty)
            GW->>RAG: Execute Grounded RAG Generation
            RAG-->>GW: Fresh Response + Citations + Usage
            GW->>T1: Write Exact Key (TTL: 3600s)
            GW->>T2: Insert Semantic Vector Entry (HNSW)
            GW->>Ledger: Record Request & Non-Authoritative Cost
            GW-->>Client: Return Response (Status: MISS, waterfall: 150-600ms)
        end
    end
```

---

## 3. Cost-Aware Dynamic Routing Flowchart with Fallback Recovery

Queries are classified by complexity based on query length, structural tokens, and multi-signal semantic triggers (comparative, analytical, and quantitative).

```mermaid
flowchart TD
    Start(["Incoming Query: POST /api/v1/query"]) --> Norm["Normalize Query & Extract Features"]
    Norm --> LengthCheck{"Query Length > 180 chars?"}
    
    LengthCheck -- Yes --> AddLen["+0.25 Complexity Score"]
    LengthCheck -- No --> EvalTriggers["Evaluate Semantic Triggers"]
    AddLen --> EvalTriggers

    EvalTriggers --> CompCheck{"Comparative Triggers?<br/>(compare, versus, difference, pros and cons)"}
    CompCheck -- Match Found --> AddComp["+0.40 first match (+0.15 additional)"]
    CompCheck -- None --> AnalCheck{"Analytical Triggers?<br/>(why, analyze, reason, explain step-by-step)"}
    AddComp --> AnalCheck

    AnalCheck -- Match Found --> AddAnal["+0.35 first match (+0.15 additional)"]
    AnalCheck -- None --> QuantCheck{"Quantitative Triggers?<br/>(calculate, sum, average, ratio, percent, audit)"}
    AddAnal --> QuantCheck

    QuantCheck -- Match Found --> AddQuant["+0.40 first match (+0.15 additional)"]
    QuantCheck -- None --> ComputeScore["Compute Total Complexity Score & Clamp [0.0, 1.0]"]
    AddQuant --> ComputeScore

    ComputeScore --> ThresholdCheck{"Score >= 0.65?"}
    
    ThresholdCheck -- "Yes (High Complexity)" --> RouteLarge["Select: mock-reasoning-large<br/>Reason: REASONING_REQUIRED<br/>Cost: $0.005 / 1k tokens"]
    ThresholdCheck -- "No (Low/Medium)" --> RouteSmall["Select: mock-fast-small<br/>Reason: LOW_COMPLEXITY_DIRECT<br/>Cost: $0.0005 / 1k tokens"]

    RouteSmall --> ExecuteSmall["Invoke Small Model Adapter"]
    ExecuteSmall --> SmallSuccess{"Inference Succeeded?"}
    
    SmallSuccess -- Yes --> ReturnSuccess(["Return Generated Grounded Answer"])
    SmallSuccess -- "No (5xx / Timeout / Rate Limit)" --> FallbackLog["Log Router Recovery Event<br/>Update Reason: FALLBACK_RETRY"]
    
    FallbackLog --> RouteLarge
    RouteLarge --> ExecuteLarge["Invoke Large Model Adapter"]
    ExecuteLarge --> ReturnSuccess
```

---

## 4. Multi-Tenant Security & Scope Boundaries

```mermaid
graph LR
    subgraph Client Ingress
        ReqTenantA["Request: Tenant A / Scope: engineering"]
        ReqTenantB["Request: Tenant B / Scope: executive"]
    end

    subgraph Cache Isolation Layer
        KeyA["Key A: SHA256('tenant-a:engineering:...')"]
        KeyB["Key B: SHA256('tenant-b:executive:...')"]
    end

    subgraph Vector Database Isolation
        VectorFilterA["SQL Filter: WHERE tenant_id='tenant-a' AND security_scope='engineering'"]
        VectorFilterB["SQL Filter: WHERE tenant_id='tenant-b' AND security_scope='executive'"]
    end

    ReqTenantA --> KeyA
    ReqTenantB --> KeyB
    KeyA --> VectorFilterA
    KeyB --> VectorFilterB

    VectorFilterA -.->|STRICT BLOCK: 0% Cross-Tenant Access| VectorFilterB
```
