"""Unit tests for cache TTL expiration, corpus version invalidation, and explicit purge."""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from backend.app.services.semantic_cache_service import SemanticCacheService
from backend.app.repositories.cache_repository import CacheRepository
from backend.app.schemas.rag import Citation


@pytest.mark.asyncio
async def test_cache_ttl_expiration():
    repo = CacheRepository()
    service = SemanticCacheService(repository=repo)

    query = "What is the timeout limit?"
    # Write entry with 1 second TTL
    await service.write(
        query=query,
        tenant_id="tenant-ttl-test",
        security_scope="default",
        response_text="Timeout limit is 5 seconds.",
        citations=[],
        ttl_seconds=1
    )

    # Immediate lookup: HIT
    hit_res = await service.lookup(query, tenant_id="tenant-ttl-test", security_scope="default")
    assert hit_res.hit is True

    # Sleep past expiration
    await asyncio.sleep(1.2)

    # Post-TTL lookup: MISS (expired)
    miss_res = await service.lookup(query, tenant_id="tenant-ttl-test", security_scope="default")
    assert miss_res.hit is False
    assert miss_res.cache_status == "MISS"


@pytest.mark.asyncio
async def test_corpus_version_invalidation():
    repo = CacheRepository()
    service = SemanticCacheService(repository=repo)

    query = "How to configure alerting?"
    await service.write(
        query=query,
        tenant_id="tenant-ver-test",
        security_scope="default",
        response_text="Alerting is configured via yaml.",
        citations=[]
    )

    # Initial lookup matches current corpus version (v1.0.0): HIT
    res1 = await service.lookup(query, tenant_id="tenant-ver-test", security_scope="default")
    assert res1.hit is True

    # Manually invalidate corpus version
    inv_res = await service.invalidate(tenant_id="tenant-ver-test", corpus_version="v1.0.0")
    assert inv_res.invalidated_count == 1

    # Post-invalidation lookup: MISS
    res2 = await service.lookup(query, tenant_id="tenant-ver-test", security_scope="default")
    assert res2.hit is False
