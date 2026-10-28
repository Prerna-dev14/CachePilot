"""Unit tests for mock provider adapters and determinism."""
import pytest
import math
from backend.app.adapters.mock_provider import MockLLMProvider, MockEmbeddingProvider
from backend.app.adapters.factory import get_llm_provider, get_embedding_provider


@pytest.mark.asyncio
async def test_mock_llm_provider_generation():
    provider = MockLLMProvider(model_name="mock-fast-small")
    resp = await provider.generate(prompt="What is CachePilot?", system="You are an assistant.")

    assert resp.text
    assert resp.model == "mock-fast-small"
    assert resp.provider == "mock"
    assert resp.prompt_tokens > 0
    assert resp.completion_tokens > 0
    assert resp.total_tokens == resp.prompt_tokens + resp.completion_tokens
    assert resp.estimated_cost_usd > 0
    assert resp.is_authoritative_billing is False


@pytest.mark.asyncio
async def test_mock_llm_provider_failure_simulation():
    provider = MockLLMProvider(model_name="mock-fast-small", simulate_failure=True)
    with pytest.raises(RuntimeError) as exc_info:
        await provider.generate(prompt="Hello")
    assert "simulated failure" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mock_embedding_provider_determinism_and_norm():
    provider = MockEmbeddingProvider(dimension=1536)

    query = "semantic caching in RAG architectures"
    vec1 = await provider.embed_query(query)
    vec2 = await provider.embed_query(query)

    # Determinism
    assert vec1 == vec2
    assert len(vec1) == 1536

    # Unit norm check (sum of squares ~ 1.0)
    norm = math.sqrt(sum(x * x for x in vec1))
    assert abs(norm - 1.0) < 0.01

    # Identical vector cosine similarity equals 1.0
    cosine_sim = sum(a * b for a, b in zip(vec1, vec2))
    assert abs(cosine_sim - 1.0) < 0.001


def test_provider_factory():
    llm = get_llm_provider("mock", "mock-fast-small")
    assert isinstance(llm, MockLLMProvider)

    embed = get_embedding_provider("mock", 1536)
    assert isinstance(embed, MockEmbeddingProvider)
    assert embed.dimension == 1536
