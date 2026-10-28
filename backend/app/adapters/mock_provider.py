"""Deterministic mock LLM and Embedding adapters for CI, local development, and tests."""
import hashlib
import math
import random
import re
import time
from typing import List, Optional
from backend.app.adapters.base import LLMProvider, EmbeddingProvider, LLMResponse


class MockLLMProvider(LLMProvider):
    """Deterministic Mock LLM Provider with configurable latency and failure simulation."""

    COST_TABLE = {
        "mock-fast-small": {"input": 0.00015, "output": 0.00060},
        "mock-reasoning-large": {"input": 0.00300, "output": 0.01500},
    }

    def __init__(
        self,
        model_name: str = "mock-fast-small",
        simulate_latency_ms: float = 0.0,
        simulate_failure: bool = False
    ):
        self.model_name = model_name
        self.simulate_latency_ms = simulate_latency_ms
        self.simulate_failure = simulate_failure

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.0
    ) -> LLMResponse:
        start_time = time.perf_counter()

        if self.simulate_failure:
            raise RuntimeError(f"MockLLMProvider simulated failure for model {self.model_name}")

        if self.simulate_latency_ms > 0:
            import asyncio
            await asyncio.sleep(self.simulate_latency_ms / 1000.0)

        prompt_hash = hashlib.md5(prompt.encode("utf-8")).hexdigest()[:8]
        generated_text = f"[MockResponse-{self.model_name}] Grounded answer for query (sig: {prompt_hash})."

        prompt_tokens = max(1, len(prompt.split())) + (len(system.split()) if system else 0)
        completion_tokens = max(1, len(generated_text.split()))
        total_tokens = prompt_tokens + completion_tokens

        costs = self.COST_TABLE.get(self.model_name, {"input": 0.0005, "output": 0.0015})
        est_cost = (prompt_tokens / 1000.0 * costs["input"]) + (completion_tokens / 1000.0 * costs["output"])

        latency = round((time.perf_counter() - start_time) * 1000 + self.simulate_latency_ms, 2)

        return LLMResponse(
            text=generated_text,
            model=self.model_name,
            provider="mock",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency,
            estimated_cost_usd=round(est_cost, 6),
            is_authoritative_billing=False
        )


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic Mock Embedding Provider with semantic keyword overlap simulation."""

    def __init__(self, dimension: int = 1536):
        self._dim = dimension

    @property
    def dimension(self) -> int:
        return self._dim

    def _word_vector(self, word: str) -> List[float]:
        """Generate deterministic component vector for an individual token."""
        seed = int(hashlib.md5(word.encode("utf-8")).hexdigest()[:8], 16)
        rng = random.Random(seed)
        return [rng.gauss(0.0, 1.0) for _ in range(self._dim)]

    def _generate_vector(self, text: str) -> List[float]:
        """Generate a semantic vector with high cosine similarity for overlapping keywords."""
        words = re.findall(r'\w+', text.lower())
        if not words:
            words = ["empty"]

        accum = [0.0] * self._dim
        for w in words:
            w_vec = self._word_vector(w)
            for i in range(self._dim):
                accum[i] += w_vec[i]

        # Small text-level fingerprint for exactness
        text_seed = int(hashlib.sha256(text.strip().lower().encode("utf-8")).hexdigest()[:8], 16)
        t_rng = random.Random(text_seed)
        for i in range(self._dim):
            accum[i] += 0.05 * t_rng.gauss(0.0, 1.0)

        magnitude = math.sqrt(sum(x * x for x in accum))
        if magnitude == 0:
            return [1.0 / math.sqrt(self._dim)] * self._dim
        return [round(x / magnitude, 6) for x in accum]

    async def embed_query(self, text: str) -> List[float]:
        return self._generate_vector(text)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]
