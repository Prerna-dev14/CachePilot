"""Semantic Cache Service coordinating normalization, exact matching, and vector similarity lookup."""
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import logging

from backend.app.services.cache_key import (
    normalize_query_text,
    compute_generation_params_hash,
    generate_scope_aware_cache_key,
)
from backend.app.schemas.cache import (
    CacheEntrySchema,
    CacheLookupResult,
    CacheMetrics,
    CacheInvalidateResponse,
)
from backend.app.schemas.rag import Citation
from backend.app.repositories.cache_repository import get_cache_repository, CacheRepository
from backend.app.adapters.factory import get_embedding_provider
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)


class SemanticCacheService:
    """Manages scoped query caching, similarity evaluation, and TTL invalidation."""

    def __init__(self, repository: Optional[CacheRepository] = None):
        self.repo = repository or get_cache_repository()
        self.settings = get_settings()

    async def lookup(
        self,
        query: str,
        tenant_id: str,
        security_scope: str,
        similarity_threshold: Optional[float] = None,
        bypass_cache: bool = False,
        generation_params: Optional[Dict[str, Any]] = None
    ) -> CacheLookupResult:
        """
        Evaluate cache for given query:
        1. If bypass_cache=True, skip lookup.
        2. Tier 1: Check exact scope-aware key match.
        3. Tier 2: Check vector cosine similarity against eligible cached candidates.
        4. Return hit or miss decision with latency and similarity score.
        """
        start_time = time.perf_counter()

        if bypass_cache or not self.settings.cache_enabled:
            self.repo.record_bypass()
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return CacheLookupResult(
                hit=False,
                cache_status="BYPASS",
                similarity_score=0.0,
                latency_ms=latency
            )

        threshold = similarity_threshold if similarity_threshold is not None else self.settings.cache_similarity_threshold
        norm_query = normalize_query_text(query)
        gen_params_hash = compute_generation_params_hash(generation_params)

        cache_key = generate_scope_aware_cache_key(
            tenant_id=tenant_id,
            security_scope=security_scope,
            normalized_query=norm_query,
            embedding_model_version=self.settings.embedding_model_name,
            corpus_version=self.settings.corpus_version,
            prompt_version=self.settings.prompt_version,
            generation_params_hash=gen_params_hash
        )

        # Tier 1: Exact Match Lookup
        exact_entry = await self.repo.find_exact_entry(
            cache_key=cache_key,
            tenant_id=tenant_id,
            security_scope=security_scope,
            corpus_version=self.settings.corpus_version,
            prompt_version=self.settings.prompt_version
        )

        if exact_entry:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            await self.repo.record_hit(exact_entry["id"], is_exact=True, avoided_cost=exact_entry.get("estimated_cost_usd", 0.0005))
            logger.info(f"Cache EXACT hit for key={cache_key[:12]}... (tenant={tenant_id}) in {latency}ms")
            return CacheLookupResult(
                hit=True,
                cache_status="HIT_EXACT",
                entry=CacheEntrySchema(**exact_entry),
                similarity_score=1.0,
                latency_ms=latency
            )

        # Tier 2: Semantic Similarity Lookup
        embedder = get_embedding_provider()
        query_embedding = await embedder.embed_query(query)

        candidate_match = await self.repo.find_semantic_candidate(
            tenant_id=tenant_id,
            security_scope=security_scope,
            query_embedding=query_embedding,
            corpus_version=self.settings.corpus_version,
            prompt_version=self.settings.prompt_version,
            similarity_threshold=threshold
        )

        if candidate_match:
            candidate, score = candidate_match
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            await self.repo.record_hit(candidate["id"], is_exact=False, avoided_cost=candidate.get("estimated_cost_usd", 0.0005))
            logger.info(f"Cache SEMANTIC hit (score={score} >= {threshold}) for tenant={tenant_id} in {latency}ms")
            return CacheLookupResult(
                hit=True,
                cache_status="HIT_SEMANTIC",
                entry=CacheEntrySchema(**candidate),
                similarity_score=score,
                latency_ms=latency
            )

        # Cache Miss
        self.repo.record_miss()
        latency = round((time.perf_counter() - start_time) * 1000, 2)
        logger.debug(f"Cache MISS for query='{norm_query[:30]}' (tenant={tenant_id}) in {latency}ms")
        return CacheLookupResult(
            hit=False,
            cache_status="MISS",
            similarity_score=0.0,
            latency_ms=latency
        )

    async def write(
        self,
        query: str,
        tenant_id: str,
        security_scope: str,
        response_text: str,
        citations: List[Citation],
        query_embedding: Optional[List[float]] = None,
        ttl_seconds: Optional[int] = None,
        estimated_cost_usd: float = 0.0,
        generation_params: Optional[Dict[str, Any]] = None
    ) -> CacheEntrySchema:
        """Persist fresh query-answer pair with scope, versioning, and TTL tags."""
        norm_query = normalize_query_text(query)
        ttl = ttl_seconds or self.settings.cache_ttl_seconds
        gen_params_hash = compute_generation_params_hash(generation_params)

        cache_key = generate_scope_aware_cache_key(
            tenant_id=tenant_id,
            security_scope=security_scope,
            normalized_query=norm_query,
            embedding_model_version=self.settings.embedding_model_name,
            corpus_version=self.settings.corpus_version,
            prompt_version=self.settings.prompt_version,
            generation_params_hash=gen_params_hash
        )

        if query_embedding is None:
            embedder = get_embedding_provider()
            query_embedding = await embedder.embed_query(query)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl)

        entry_dict = {
            "id": f"ce-{uuid.uuid4().hex[:10]}",
            "tenant_id": tenant_id,
            "security_scope": security_scope,
            "cache_key": cache_key,
            "query_text": query,
            "normalized_query": norm_query,
            "query_embedding": query_embedding,
            "response_text": response_text,
            "citations": citations,
            "embedding_model_version": self.settings.embedding_model_name,
            "corpus_version": self.settings.corpus_version,
            "prompt_version": self.settings.prompt_version,
            "generation_params_hash": gen_params_hash,
            "ttl_seconds": ttl,
            "expires_at": expires_at,
            "hit_count": 1,
            "estimated_cost_usd": estimated_cost_usd,
            "created_at": now,
            "last_accessed_at": now
        }

        await self.repo.save_entry(entry_dict)
        return CacheEntrySchema(**entry_dict)

    async def invalidate(
        self,
        tenant_id: str,
        security_scope: Optional[str] = None,
        corpus_version: Optional[str] = None
    ) -> CacheInvalidateResponse:
        """Purge scoped cache entries matching criteria."""
        count = await self.repo.invalidate(
            tenant_id=tenant_id,
            security_scope=security_scope,
            corpus_version=corpus_version
        )
        return CacheInvalidateResponse(
            invalidated_count=count,
            tenant_id=tenant_id,
            message=f"Purged {count} cached entries for tenant={tenant_id}"
        )

    async def list_entries(self, tenant_id: str) -> List[CacheEntrySchema]:
        raw_list = await self.repo.list_entries(tenant_id=tenant_id)
        return [CacheEntrySchema(**item) for item in raw_list]

    def get_metrics(self) -> CacheMetrics:
        data = self.repo.get_metrics()
        return CacheMetrics(**data)
