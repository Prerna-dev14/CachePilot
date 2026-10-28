"""Provider adapter factory."""
from typing import Optional
from backend.app.adapters.base import LLMProvider, EmbeddingProvider
from backend.app.adapters.mock_provider import MockLLMProvider, MockEmbeddingProvider
from backend.app.core.config import get_settings


def get_llm_provider(
    provider_name: Optional[str] = None,
    model_name: Optional[str] = None,
    simulate_failure: bool = False
) -> LLMProvider:
    """Instantiate and return requested LLM provider adapter."""
    settings = get_settings()
    name = (provider_name or settings.default_llm_provider).lower()

    if name == "mock":
        selected_model = model_name or settings.small_model_name
        return MockLLMProvider(model_name=selected_model, simulate_failure=simulate_failure)
    elif name == "openai":
        # Placeholder for OpenAI adapter when real API key is configured
        raise NotImplementedError("OpenAI provider adapter configured in later phase or requires real credentials")
    elif name == "anthropic":
        raise NotImplementedError("Anthropic provider adapter configured in later phase or requires real credentials")
    elif name == "ollama":
        raise NotImplementedError("Ollama provider adapter configured in later phase or requires local Ollama host")
    else:
        raise ValueError(f"Unknown LLM provider: {name}")


def get_embedding_provider(
    provider_name: Optional[str] = None,
    dimension: Optional[int] = None
) -> EmbeddingProvider:
    """Instantiate and return requested Embedding provider adapter."""
    settings = get_settings()
    name = (provider_name or settings.default_embedding_provider).lower()
    dim = dimension or settings.embedding_dimension

    if name == "mock":
        return MockEmbeddingProvider(dimension=dim)
    elif name == "openai":
        raise NotImplementedError("OpenAI embedding adapter configured in later phase or requires real credentials")
    else:
        raise ValueError(f"Unknown embedding provider: {name}")
