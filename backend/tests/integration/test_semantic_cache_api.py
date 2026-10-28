"""Integration tests for Semantic Cache endpoints and Hit/Miss/Bypass workflows."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cache_api_hit_miss_bypass_flow(async_client: AsyncClient):
    tenant = "tenant-cache-api"
    # 1. Ingest document
    await async_client.post("/api/v1/documents", json={
        "title": "System Scalability Guidelines",
        "content": "Horizontal autoscaling triggers when CPU utilization exceeds 75 percent for five consecutive minutes.",
        "tenant_id": tenant,
        "security_scope": "default"
    })

    # 2. First query: MISS -> computes answer & stores in cache
    q1 = {
        "query": "When does horizontal autoscaling trigger?",
        "tenant_id": tenant,
        "security_scope": "default",
        "bypass_cache": False
    }
    resp1 = await async_client.post("/api/v1/query", json=q1)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["telemetry"]["cache_status"] == "MISS"
    assert data1["telemetry"]["tokens"]["total_tokens"] > 0

    # 3. Identical second query: EXACT HIT -> 0 tokens, 0 estimated cost
    resp2 = await async_client.post("/api/v1/query", json=q1)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["telemetry"]["cache_status"] == "HIT_EXACT"
    assert data2["telemetry"]["route"] == "cache"
    assert data2["telemetry"]["tokens"]["total_tokens"] == 0
    assert data2["telemetry"]["estimated_cost_usd"] == 0.0

    # 4. Semantically related query: SEMANTIC HIT
    q_similar = {
        "query": "when does horizontal autoscaling trigger in system",
        "tenant_id": tenant,
        "security_scope": "default",
        "bypass_cache": False,
        "similarity_threshold": 0.80
    }
    resp3 = await async_client.post("/api/v1/query", json=q_similar)
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["telemetry"]["cache_status"] in {"HIT_SEMANTIC", "HIT_EXACT"}
    assert data3["telemetry"]["route"] == "cache"

    # 5. Query with bypass_cache=True: BYPASS
    q_bypass = {
        "query": "When does horizontal autoscaling trigger?",
        "tenant_id": tenant,
        "security_scope": "default",
        "bypass_cache": True
    }
    resp4 = await async_client.post("/api/v1/query", json=q_bypass)
    assert resp4.status_code == 200
    data4 = resp4.json()
    assert data4["telemetry"]["cache_status"] == "BYPASS"

    # 6. Verify cache metrics endpoint
    metrics_resp = await async_client.get("/api/v1/cache/metrics")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics["total_entries"] >= 1
    assert metrics["exact_hit_count"] >= 1
    assert metrics["hit_rate_percentage"] > 0.0

    # 7. Invalidate cache
    inv_resp = await async_client.post("/api/v1/cache/invalidate", json={
        "tenant_id": tenant,
        "security_scope": "default"
    })
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    assert inv_data["invalidated_count"] >= 1

    # 8. Post-invalidation query: MISS
    resp5 = await async_client.post("/api/v1/query", json=q1)
    assert resp5.status_code == 200
    assert resp5.json()["telemetry"]["cache_status"] == "MISS"
