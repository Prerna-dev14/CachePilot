"""Router Classification and Usage Ledger Endpoints."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException, status
from backend.app.schemas.routing import (
    ClassifyQueryRequest,
    ClassifyQueryResponse,
    RequestLedgerEntry,
    RequestLedgerDetail,
    MetricsSummary,
)
from backend.app.services.router_service import RouterService
from backend.app.services.ledger_service import LedgerService
from backend.app.core.config import get_settings

router = APIRouter(prefix="/api/v1", tags=["Routing & Usage Ledger"])
_router_service = RouterService()
_ledger_service = LedgerService()
_settings = get_settings()


@router.post(
    "/router/classify",
    response_model=ClassifyQueryResponse,
    summary="Classify Query Complexity",
    description="Analyze lexical, reasoning, and context signals to preview routing tier and reason code."
)
async def classify_query(req: ClassifyQueryRequest) -> ClassifyQueryResponse:
    score, signals = _router_service.classify_complexity(
        query=req.query,
        context_token_estimate=req.context_token_estimate
    )
    decision = _router_service.route_query(
        query=req.query,
        context_token_estimate=req.context_token_estimate
    )
    return ClassifyQueryResponse(
        query=req.query,
        complexity_score=score,
        selected_tier=decision.tier,
        selected_model=decision.model_name,
        reason_code=decision.reason_code,
        detected_signals=signals,
        threshold=_settings.routing_complexity_threshold
    )


@router.get(
    "/ledger/requests",
    response_model=List[RequestLedgerEntry],
    summary="List Request Ledger Entries",
    description="Query historical request executions with filters for route, cache status, and tenant."
)
async def list_ledger_requests(
    tenant_id: str = Query(default="tenant-default", description="Tenant isolation scope"),
    limit: int = Query(default=50, ge=1, le=200),
    route: Optional[str] = Query(default=None, description="Filter by route: small, large, cache"),
    cache_status: Optional[str] = Query(default=None, description="Filter by cache status")
) -> List[RequestLedgerEntry]:
    return await _ledger_service.list_requests(
        tenant_id=tenant_id,
        limit=limit,
        route_filter=route,
        cache_filter=cache_status
    )


@router.get(
    "/ledger/requests/{request_id}",
    response_model=RequestLedgerDetail,
    summary="Get Request Ledger Detail",
    description="Retrieve per-request diagnostics including model execution breakdown."
)
async def get_ledger_request_detail(request_id: str) -> RequestLedgerDetail:
    detail = await _ledger_service.get_request_detail(request_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request '{request_id}' not found in ledger"
        )
    return detail


@router.get(
    "/metrics/summary",
    response_model=MetricsSummary,
    summary="Aggregated Gateway Metrics",
    description="Return high-level operational metrics: total requests, cache hit rate, cost, latency, and model mix."
)
async def get_metrics_summary(
    tenant_id: str = Query(default="tenant-default", description="Tenant isolation scope")
) -> MetricsSummary:
    raw_metrics = _ledger_service.get_summary_metrics(tenant_id)
    return MetricsSummary(**raw_metrics)
