"""Pytest configuration and shared test fixtures."""
import os
import pytest
from httpx import AsyncClient, ASGITransport

# Set testing environment before importing app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["DEFAULT_LLM_PROVIDER"] = "mock"
os.environ["DEFAULT_EMBEDDING_PROVIDER"] = "mock"

from backend.app.main import app
from backend.app.core.config import get_settings


@pytest.fixture(scope="session")
def test_settings():
    return get_settings()


@pytest.fixture
async def async_client():
    """Async test client for testing FastAPI endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
