"""Semantic Cache Management & Telemetry Endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Query, status
from backend.app.schemas.cache import (
    CacheEntrySchema,
    CacheInvalidateRequest,
    CacheInvalidateResponse,
    CacheMetrics,
)
from backend.app.services.semantic_cache_service import SemanticCacheService

router = APIRouter(prefix="/api/v1/cache", tags=["Semantic Cache"])
_cache_service = SemanticCacheService()


@router.post(
    "/invalidate",
    response_model=CacheInvalidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Invalidate Cache",
    description="Purge cached entries matching tenant, security scope, or corpus version."
)
async def invalidate_cache(req: CacheInvalidateRequest) -> CacheInvalidateResponse:
    return await _cache_service.invalidate(
        tenant_id=req.tenant_id,
        security_scope=req.security_scope,
        corpus_version=req.corpus_version
    )


@router.get(
    "/entries",
    response_model=List[CacheEntrySchema],
    summary="List Cache Entries",
    description="Inspect cached question-answer entries for an authorized tenant scope."
)
async def list_cache_entries(
    tenant_id: str = Query(default="tenant-default", description="Tenant isolation scope")
) -> List[CacheEntrySchema]:
    return await _cache_service.list_entries(tenant_id=tenant_id)


@router.get(
    "/metrics",
    response_model=CacheMetrics,
    summary="Cache Telemetry Metrics",
    description="Retrieve aggregated cache hit rates, exact vs semantic count, and estimated cost avoided."
)
async def get_cache_metrics() -> CacheMetrics:
    return _cache_service.get_metrics()
