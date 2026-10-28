"""Pydantic schemas for RAG documents, queries, citations, and telemetry."""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TokenUsage(BaseModel):
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class LatencyBreakdown(BaseModel):
    cache_lookup: float = Field(default=0.0, ge=0.0)
    retrieval: float = Field(default=0.0, ge=0.0)
    generation: float = Field(default=0.0, ge=0.0)
    total: float = Field(default=0.0, ge=0.0)


class Citation(BaseModel):
    document_id: str
    chunk_id: str
    document_title: str
    score: float = Field(description="Cosine similarity score (0.0 to 1.0)")
    text_snippet: str


class QueryTelemetry(BaseModel):
    cache_status: str = Field(default="MISS", description="HIT_EXACT, HIT_SEMANTIC, MISS, BYPASS")
    similarity_score: Optional[float] = None
    route: str = Field(default="small", description="small, large, or cache")
    route_reason: str = Field(default="BASELINE_RAG_DIRECT")
    tokens: TokenUsage = Field(default_factory=TokenUsage)
    estimated_cost_usd: float = Field(default=0.0, ge=0.0)
    is_authoritative_billing: bool = Field(default=False)
    latencies_ms: LatencyBreakdown = Field(default_factory=LatencyBreakdown)


class DocumentIngestRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    content: str = Field(..., min_length=1)
    tenant_id: str = Field(default="tenant-default", min_length=1, max_length=64)
    security_scope: str = Field(default="default", min_length=1, max_length=64)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentIngestResponse(BaseModel):
    document_id: str
    title: str
    tenant_id: str
    security_scope: str
    chunk_count: int
    content_hash: str
    corpus_version: str
    created_at: datetime


class DocumentSummary(BaseModel):
    document_id: str
    title: str
    tenant_id: str
    security_scope: str
    chunk_count: int
    content_hash: str
    created_at: datetime


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    tenant_id: str = Field(default="tenant-default", min_length=1, max_length=64)
    security_scope: str = Field(default="default", min_length=1, max_length=64)
    top_k: int = Field(default=3, ge=1, le=10)
    bypass_cache: bool = Field(default=False)
    conversation_id: Optional[str] = Field(default=None)


class QueryResponse(BaseModel):
    request_id: str
    query: str
    answer: str
    citations: List[Citation]
    telemetry: QueryTelemetry
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
