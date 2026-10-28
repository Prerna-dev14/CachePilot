"""Integration tests for evaluation benchmark endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_evaluation_benchmark_endpoint(async_client: AsyncClient):
    response = await async_client.get("/api/v1/evaluation/benchmark?tenant_id=tenant-test-api")
    assert response.status_code == 200
    data = response.json()

    assert data["tenant_id"] == "tenant-test-api"
    assert data["total_queries"] == 8
    assert data["overall_cost_reduction_percent"] > 0
    assert data["overall_latency_reduction_percent"] > 0
    assert data["is_authoritative_billing"] is False
    assert len(data["items"]) == 8


@pytest.mark.asyncio
async def test_run_evaluation_benchmark_endpoint(async_client: AsyncClient):
    response = await async_client.post("/api/v1/evaluation/run?tenant_id=tenant-test-api")
    assert response.status_code == 200
    data = response.json()

    assert data["run_id"].startswith("eval-run-")
    assert data["citation_coverage_percent"] == 100.0
