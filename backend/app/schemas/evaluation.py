"""Schemas for Offline Quality Evaluation and Performance Benchmark comparisons."""
from datetime import datetime, timezone
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class BenchmarkResultItem(BaseModel):
    query_id: str
    category: str  # direct_lookup, comparative_reasoning, analytical_reasoning, quantitative_math, cache_paraphrase
    query: str
    baseline_model: str = "mock-reasoning-large"
    baseline_cost_usd: float
    baseline_latency_ms: float
    cpilot_cache_status: str  # hit_exact, hit_semantic, miss
    cpilot_route: str  # small, large, cache
    cpilot_model: str
    cpilot_route_reason: str
    cpilot_cost_usd: float
    cpilot_latency_ms: float
    cost_reduction_percent: float
    latency_reduction_percent: float
    citation_count: int
    grounded_faithfulness_score: float = Field(default=1.0, ge=0.0, le=1.0)


class BenchmarkRunResponse(BaseModel):
    run_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tenant_id: str
    benchmark_dataset_version: str = "v1.0.0-enterprise-eval"
    total_queries: int
    cache_hit_count: int
    cache_hit_rate_percent: float
    small_model_route_percent: float
    large_model_route_percent: float
    total_baseline_cost_usd: float
    total_cpilot_cost_usd: float
    overall_cost_reduction_percent: float
    avg_baseline_latency_ms: float
    avg_cpilot_latency_ms: float
    overall_latency_reduction_percent: float
    citation_coverage_percent: float
    is_authoritative_billing: bool = False
    items: List[BenchmarkResultItem] = Field(default_factory=list)
