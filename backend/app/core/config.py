"""Configuration management for CachePilot."""
from typing import List, Optional, Any, Dict
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable loading and validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # Application
    environment: str = Field(default="development", description="Application environment (development/production/testing)")
    log_level: str = Field(default="INFO", description="Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    app_host: str = Field(default="0.0.0.0", description="Host to bind server")
    app_port: int = Field(default=8000, description="Port to bind server")
    debug: bool = Field(default=False, description="Enable debug mode")

    # Security & CORS
    allowed_origins: List[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Allowed CORS origins"
    )
    api_key_header: str = Field(default="X-API-Key", description="Header name for client API key")
    gateway_api_key: Optional[SecretStr] = Field(default=None, description="Master gateway API key")

    # Persistence
    database_url: str = Field(
        default="postgresql+asyncpg://cachepilot:cachepilot_secret@localhost:5432/cachepilot",
        description="PostgreSQL async connection string"
    )
    database_pool_size: int = Field(default=10, ge=1, le=50)
    database_max_overflow: int = Field(default=20, ge=0, le=100)
    database_timeout_seconds: float = Field(default=10.0, gt=0.0)

    # Redis Cache Storage
    redis_url: str = Field(default="redis://localhost:6379/0", description="Redis connection URL")
    redis_key_prefix: str = Field(default="cpilot:", description="Key prefix for Redis items")
    redis_default_ttl_seconds: int = Field(default=3600, ge=60)

    # LLM & Embedding Providers
    default_llm_provider: str = Field(default="mock", description="Default provider: mock, openai, anthropic, ollama")
    small_model_name: str = Field(default="mock-fast-small", description="Model name for fast/small routing")
    large_model_name: str = Field(default="mock-reasoning-large", description="Model name for deep reasoning")

    default_embedding_provider: str = Field(default="mock", description="Default provider: mock, openai")
    embedding_model_name: str = Field(default="mock-embedding-v1", description="Model name for embeddings")
    embedding_dimension: int = Field(default=1536, ge=16, le=4096)

    openai_api_key: Optional[SecretStr] = Field(default=None)
    anthropic_api_key: Optional[SecretStr] = Field(default=None)
    ollama_base_url: str = Field(default="http://localhost:11434")

    # Semantic Cache Policy Defaults
    cache_similarity_threshold: float = Field(default=0.88, ge=0.0, le=1.0)
    cache_enabled: bool = Field(default=True)
    cache_ttl_seconds: int = Field(default=86400, ge=60)
    corpus_version: str = Field(default="v1.0.0")
    prompt_version: str = Field(default="v1.0.0")

    # Cost-Aware Routing Defaults
    routing_complexity_threshold: float = Field(default=0.65, ge=0.0, le=1.0)
    fallback_to_large_on_error: bool = Field(default=True)

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests_per_minute: int = Field(default=120, ge=1)

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        val = v.upper()
        if val not in valid_levels:
            raise ValueError(f"Invalid log_level: {v}. Must be one of {valid_levels}")
        return val

    @field_validator("default_llm_provider", "default_embedding_provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        valid = {"mock", "openai", "anthropic", "ollama"}
        val = v.lower()
        if val not in valid:
            raise ValueError(f"Unsupported provider: {v}. Allowed: {valid}")
        return val

    def safe_dump(self) -> Dict[str, Any]:
        """Return non-sensitive configuration dictionary for diagnostics."""
        data = self.model_dump(exclude={"openai_api_key", "anthropic_api_key", "gateway_api_key"})
        # Mask credentials in database_url
        if "@" in self.database_url:
            prefix, rest = self.database_url.split("@", 1)
            data["database_url"] = f"***@{rest}"
        if "@" in self.redis_url:
            prefix, rest = self.redis_url.split("@", 1)
            data["redis_url"] = f"***@{rest}"
        data["has_openai_key"] = bool(self.openai_api_key)
        data["has_anthropic_key"] = bool(self.anthropic_api_key)
        data["has_gateway_key"] = bool(self.gateway_api_key)
        return data


# Cached settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Retrieve or initialize singleton application settings."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
