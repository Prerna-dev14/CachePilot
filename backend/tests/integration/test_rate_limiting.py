"""Integration tests for Rate Limiting middleware."""
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.api.middleware import RateLimitMiddleware


@pytest.mark.asyncio
async def test_rate_limiting_headers_on_standard_request(async_client: AsyncClient):
    # Standard query request gets rate limit headers
    resp = await async_client.get("/api/v1/metrics/summary")
    assert resp.status_code == 200
    assert "X-RateLimit-Limit" in resp.headers
    assert "X-RateLimit-Remaining" in resp.headers
    assert int(resp.headers["X-RateLimit-Remaining"]) >= 0


@pytest.mark.asyncio
async def test_health_probes_exempt_from_rate_limits(async_client: AsyncClient):
    # Health probe should not be throttled even with rapid polling
    for _ in range(5):
        resp = await async_client.get("/health/live")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_rate_limit_throttle_trigger():
    # Instantiate custom FastAPI app with strict limit of 3 req/min to test 429 throttling
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    test_app = FastAPI()
    test_app.add_middleware(RateLimitMiddleware, requests_per_minute=3, enabled=True)

    @test_app.get("/test-endpoint")
    async def endpoint():
        return {"status": "ok"}

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request 1, 2, 3 should succeed
        r1 = await client.get("/test-endpoint")
        assert r1.status_code == 200
        assert r1.headers["X-RateLimit-Remaining"] == "2"

        r2 = await client.get("/test-endpoint")
        assert r2.status_code == 200
        assert r2.headers["X-RateLimit-Remaining"] == "1"

        r3 = await client.get("/test-endpoint")
        assert r3.status_code == 200
        assert r3.headers["X-RateLimit-Remaining"] == "0"

        # Request 4 should be throttled (429 Too Many Requests)
        r4 = await client.get("/test-endpoint")
        assert r4.status_code == 429
        data = r4.json()
        assert data["error"] == "TooManyRequests"
        assert "Retry-After" in r4.headers
        assert r4.headers["X-RateLimit-Remaining"] == "0"
