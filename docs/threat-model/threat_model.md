# CachePilot Threat Model & Security Controls

## 1. Overview
CachePilot operates as an AI gateway mediating user queries, vector databases, caches, and third-party LLMs. Because it stores semantic cached responses and manages multi-tenant RAG contexts, robust security controls are required.

## 2. Threat Analysis & Mitigations

### Threat 1: Cross-Tenant & Cross-Scope Cache Leakage
- **Risk**: Tenant A asks a sensitive internal question. Tenant B asks a semantically similar question and receives Tenant A's cached response.
- **Severity**: Critical.
- **Mitigation**:
  - The cache key and candidate retrieval vector query are strictly partitioned by `tenant_id` and `security_scope`.
  - The SQL / vector search query includes a hard WHERE clause: `WHERE tenant_id = :tenant_id AND security_scope = :security_scope`.
  - Automated tests (`test_cache_scope_isolation`) verify zero cross-scope retrieval.

### Threat 2: Stale Cache Serving Inaccurate Data
- **Risk**: A knowledge document is updated or deleted, but CachePilot continues to serve outdated answers from the cache.
- **Severity**: High.
- **Mitigation**:
  - Cache entries are tagged with `corpus_version`, `prompt_version`, and individual document timestamps.
  - Updating a corpus increments `corpus_version`, rendering previous entries un-matchable.
  - Automatic TTL expiration and explicit invalidation endpoints (`/api/v1/cache/invalidate`).

### Threat 3: Secret & Credential Exposure
- **Risk**: Provider API keys leaked in git commits, error stack traces, or diagnostic logs.
- **Severity**: Critical.
- **Mitigation**:
  - Configuration fails safely if required values are missing without logging raw secrets.
  - Pydantic `SecretStr` used for all API keys.
  - Request logging intercepts sanitize authorization headers and sensitive payloads.
  - Repository gitignore excludes all `.env` files.

### Threat 4: Prompt Injection & Context Poisoning
- **Risk**: Malicious source documents or user queries manipulate model system instructions.
- **Severity**: High.
- **Mitigation**:
  - Clear structural separation between System Instructions, Retrieved Context Chunks, and User Queries.
  - Context chunks are treated as untrusted data and bounded to maximum character limits.
  - Defensive generation prompts instructing model to strictly answer using provided evidence.

### Threat 5: Denial of Service & Resource Exhaustion
- **Risk**: Flooding requests with large payloads exhausting database connections or LLM spend.
- **Severity**: Medium-High.
- **Mitigation**:
  - Configurable rate limiter per client IP/API key.
  - Strict Pydantic payload size validation (query length maximum 4,000 characters).
  - Timeouts on all outbound LLM and database calls with bounded exponential backoff.
