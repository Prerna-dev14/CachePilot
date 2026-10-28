"""Integration tests for Health and Readiness APIs."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_live_endpoint(async_client: AsyncClient):
    response = await async_client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "cachepilot"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data

    # Check correlation ID header
    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"].startswith("cpilot-")


@pytest.mark.asyncio
async def test_custom_correlation_id_propagation(async_client: AsyncClient):
    custom_id = "custom-client-trace-4242"
    response = await async_client.get("/health/live", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.asyncio
async def test_health_ready_endpoint(async_client: AsyncClient):
    response = await async_client.get("/health/ready")
    # In test mode with sqlite in-memory and redis fallback, health should be returned
    assert response.status_code in {200, 503}
    data = response.json()
    assert "status" in data
    assert "dependencies" in data
    assert "database" in data["dependencies"]
    assert "redis" in data["dependencies"]
