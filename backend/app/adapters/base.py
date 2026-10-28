"""Abstract Base Classes and models for LLM and Embedding provider adapters."""
from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel, Field


class LLMResponse(BaseModel):
    """Standardized response from an LLM provider."""
    text: str = Field(description="Generated answer text")
    model: str = Field(description="Name of the model invoked")
    provider: str = Field(description="Provider name e.g. mock, openai, anthropic")
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    latency_ms: float = Field(default=0.0, ge=0.0)
    estimated_cost_usd: float = Field(default=0.0, ge=0.0)
    is_authoritative_billing: bool = Field(default=False)


class LLMProvider(ABC):
    """Abstract interface for Language Model providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.0
    ) -> LLMResponse:
        """Generate response text for the given prompt and system instructions."""
        pass


class EmbeddingProvider(ABC):
    """Abstract interface for Vector Embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding vector dimension."""
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Generate vector embedding for a single query."""
        pass

    @abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of documents or chunks."""
        pass
