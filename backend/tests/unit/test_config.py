"""Unit tests for configuration validation and security."""
import pytest
from pydantic import ValidationError, SecretStr
from backend.app.core.config import Settings


def test_default_settings():
    settings = Settings()
    assert settings.environment in {"development", "testing"}
    assert settings.cache_similarity_threshold == 0.88
    assert settings.embedding_dimension == 1536
    assert settings.default_llm_provider == "mock"


def test_invalid_log_level():
    with pytest.raises(ValidationError):
        Settings(log_level="NOT_A_LEVEL")


def test_invalid_threshold_bounds():
    with pytest.raises(ValidationError):
        Settings(cache_similarity_threshold=1.5)

    with pytest.raises(ValidationError):
        Settings(cache_similarity_threshold=-0.1)


def test_safe_dump_masks_secrets():
    settings = Settings(
        openai_api_key=SecretStr("sk-super-secret-key-12345"),
        gateway_api_key=SecretStr("gw-secret-token"),
        database_url="postgresql+asyncpg://admin:super_secret_pw@db.internal:5432/cachepilot",
        redis_url="redis://:redis_secret_password@cache.internal:6379/0"
    )
    dumped = settings.safe_dump()

    # Ensure raw secrets do not appear
    assert "sk-super-secret-key-12345" not in str(dumped)
    assert "gw-secret-token" not in str(dumped)
    assert "super_secret_pw" not in str(dumped)
    assert "redis_secret_password" not in str(dumped)

    # Ensure mask flags are set
    assert dumped["has_openai_key"] is True
    assert dumped["has_gateway_key"] is True
    assert "***@" in dumped["database_url"]
    assert "***@" in dumped["redis_url"]
