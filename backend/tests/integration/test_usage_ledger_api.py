"""Integration tests for Usage Ledger and Router Classification APIs."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_router_classify_endpoint(async_client: AsyncClient):
    # Test simple query classification
    resp1 = await async_client.post("/api/v1/router/classify", json={
        "query": "What is the retention limit?"
    })
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["selected_tier"] == "small"
    assert data1["reason_code"] == "LOW_COMPLEXITY_DIRECT"
    assert data1["complexity_score"] < data1["threshold"]

    # Test complex comparative query classification
    resp2 = await async_client.post("/api/v1/router/classify", json={
        "query": "Compare and evaluate the difference between vector similarity and exact hashing step by step."
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["selected_tier"] == "large"
    assert data2["reason_code"] == "REASONING_REQUIRED"
    assert data2["complexity_score"] >= data2["threshold"]


@pytest.mark.asyncio
async def test_usage_ledger_flow_and_summary_metrics(async_client: AsyncClient):
    tenant = "tenant-ledger-api"

    # 1. Ingest document
    await async_client.post("/api/v1/documents", json={
        "title": "Disaster Recovery Guide",
        "content": "RPO is 1 hour and RTO is 4 hours across multi-region standby clusters.",
        "tenant_id": tenant,
        "security_scope": "default"
    })

    # 2. Query 1: Simple factual query -> routes small
    resp1 = await async_client.post("/api/v1/query", json={
        "query": "What is the RPO target?",
        "tenant_id": tenant,
        "security_scope": "default"
    })
    assert resp1.status_code == 200
    req_id_1 = resp1.json()["request_id"]

    # 3. Query 2: Complex comparative query -> routes large
    resp2 = await async_client.post("/api/v1/query", json={
        "query": "Compare the tradeoffs between RPO and RTO for standby clusters.",
        "tenant_id": tenant,
        "security_scope": "default"
    })
    assert resp2.status_code == 200
    assert resp2.json()["telemetry"]["route"] == "large"
    assert resp2.json()["telemetry"]["route_reason"] == "REASONING_REQUIRED"
    req_id_2 = resp2.json()["request_id"]

    # 4. List ledger entries
    ledger_resp = await async_client.get(f"/api/v1/ledger/requests?tenant_id={tenant}")
    assert ledger_resp.status_code == 200
    entries = ledger_resp.json()
    assert len(entries) >= 2
    assert any(e["request_id"] == req_id_1 for e in entries)
    assert any(e["request_id"] == req_id_2 for e in entries)

    # 5. Get ledger detail for specific request
    detail_resp = await async_client.get(f"/api/v1/ledger/requests/{req_id_2}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["ledger_entry"]["request_id"] == req_id_2
    assert detail["ledger_entry"]["route"] == "large"
    assert len(detail["model_usages"]) > 0
    assert detail["model_usages"][0]["model_name"] == "mock-reasoning-large"

    # 6. Check summary metrics
    metrics_resp = await async_client.get(f"/api/v1/metrics/summary?tenant_id={tenant}")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()
    assert metrics["total_requests"] >= 2
    assert metrics["estimated_total_cost_usd"] > 0
    assert "large" in metrics["model_distribution"]
