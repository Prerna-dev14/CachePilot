"""Tests validating secrets and credential masking across configurations, health endpoints, and responses."""
import pytest
from httpx import AsyncClient
from backend.app.core.config import Settings
from pydantic import SecretStr


def test_safe_dump_masks_all_api_keys_and_passwords():
    settings = Settings(
        gateway_api_key=SecretStr("super_secret_gateway_key_9999"),
        openai_api_key=SecretStr("sk-test-fake-key-12345678"),
        anthropic_api_key=SecretStr("sk-ant-test-fake-key-87654321"),
        database_url="postgresql+asyncpg://admin:mypassword123@localhost:5432/cpdb"
    )
    dumped = settings.safe_dump()

    # Passwords and secret keys must be excluded or masked
    assert "gateway_api_key" not in dumped
    assert "openai_api_key" not in dumped
    assert "anthropic_api_key" not in dumped
    assert dumped["has_gateway_key"] is True
    assert dumped["has_openai_key"] is True
    assert dumped["has_anthropic_key"] is True
    assert "mypassword123" not in dumped["database_url"]
    assert "***@" in dumped["database_url"]


@pytest.mark.asyncio
async def test_health_ready_config_summary_contains_no_cleartext_secrets(async_client: AsyncClient):
    resp = await async_client.get("/health/ready")
    assert resp.status_code in (200, 503)
    data = resp.json()

    # Verify response body contains no cleartext database passwords
    text_data = str(data)
    assert "cachepilot_secret" not in text_data
    assert "password" not in text_data.lower() or "password" not in data.get("config_summary", {})
