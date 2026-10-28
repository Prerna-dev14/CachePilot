"""Pydantic schemas for Semantic Cache entries, invalidation, and metrics."""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.app.schemas.rag import Citation


class CacheEntrySchema(BaseModel):
    id: str
    tenant_id: str
    security_scope: str
    cache_key: str
    query_text: str
    normalized_query: str
    response_text: str
    citations: List[Citation] = Field(default_factory=list)
    embedding_model_version: str
    corpus_version: str
    prompt_version: str
    generation_params_hash: str
    ttl_seconds: int
    expires_at: datetime
    hit_count: int = 1
    created_at: datetime
    last_accessed_at: datetime


class CacheInvalidateRequest(BaseModel):
    tenant_id: str = Field(default="tenant-default", min_length=1)
    security_scope: Optional[str] = Field(default=None)
    corpus_version: Optional[str] = Field(default=None)


class CacheInvalidateResponse(BaseModel):
    invalidated_count: int
    tenant_id: str
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CacheMetrics(BaseModel):
    total_entries: int
    exact_hit_count: int
    semantic_hit_count: int
    miss_count: int
    bypass_count: int
    hit_rate_percentage: float
    estimated_cost_avoided_usd: float
    is_authoritative_billing: bool = False


class CacheLookupResult(BaseModel):
    hit: bool
    cache_status: str  # HIT_EXACT, HIT_SEMANTIC, MISS, BYPASS
    entry: Optional[CacheEntrySchema] = None
    similarity_score: float = 0.0
    latency_ms: float = 0.0
