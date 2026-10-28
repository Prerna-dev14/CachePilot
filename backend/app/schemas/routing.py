"""Pydantic schemas for Complexity Classification, Routing Decisions, and the Usage Ledger."""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RouteDecision(BaseModel):
    model_name: str
    tier: str  # small or large
    reason_code: str  # LOW_COMPLEXITY_DIRECT, REASONING_REQUIRED, FALLBACK_RETRY, CACHE_HIT
    complexity_score: float = Field(ge=0.0, le=1.0)
    complexity_reasons: List[str] = Field(default_factory=list)


class ClassifyQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    context_token_estimate: int = Field(default=0, ge=0)
    tenant_id: str = Field(default="tenant-default")


class ClassifyQueryResponse(BaseModel):
    query: str
    complexity_score: float
    selected_tier: str
    selected_model: str
    reason_code: str
    detected_signals: List[str]
    threshold: float


class ModelUsageRecord(BaseModel):
    id: str
    request_id: str
    model_name: str
    provider_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    unit_cost_input: float
    unit_cost_output: float
    estimated_cost_usd: float
    latency_ms: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RequestLedgerEntry(BaseModel):
    id: str
    request_id: str
    tenant_id: str
    security_scope: str
    query_text: str
    cache_status: str
    route: str
    route_reason: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    is_authoritative_billing: bool = False
    latency_cache_ms: float
    latency_retrieval_ms: float
    latency_generation_ms: float
    latency_total_ms: float
    error_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RequestLedgerDetail(BaseModel):
    ledger_entry: RequestLedgerEntry
    model_usages: List[ModelUsageRecord] = Field(default_factory=list)


class MetricsSummary(BaseModel):
    total_requests: int
    cache_hits: int
    cache_hit_rate: float
    estimated_total_cost_usd: float
    p50_latency_ms: float
    p95_latency_ms: float
    model_distribution: Dict[str, int] = Field(default_factory=dict)
