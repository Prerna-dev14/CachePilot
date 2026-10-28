"""Dual-tier cache repository supporting exact lookup and scoped vector candidate retrieval."""
import math
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import logging
from backend.app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)


class CacheRepository:
    """Manages exact-match Tier 1 cache and pgvector/in-memory Tier 2 semantic cache."""

    def __init__(self):
        # In-memory storage for Tier 2 vector embeddings & standalone mode
        self._entries: Dict[str, Dict[str, Any]] = {}
        # Metrics accounting
        self._exact_hits = 0
        self._semantic_hits = 0
        self._misses = 0
        self._bypasses = 0
        self._estimated_cost_avoided = 0.0

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Compute cosine similarity between two normalized vectors."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return max(0.0, min(1.0, dot_product / (norm_a * norm_b)))

    async def find_exact_entry(
        self,
        cache_key: str,
        tenant_id: str,
        security_scope: str,
        corpus_version: str,
        prompt_version: str
    ) -> Optional[Dict[str, Any]]:
        """Tier 1: Fast exact key lookup with freshness and scope validation."""
        for entry in self._entries.values():
            if entry["cache_key"] == cache_key:
                # Validate tenant isolation & security boundary
                if entry["tenant_id"] != tenant_id or entry["security_scope"] != security_scope:
                    logger.warning("Scope mismatch detected on exact cache match! Denying reuse.")
                    continue

                # Validate freshness (TTL and version tags)
                now = datetime.now(timezone.utc)
                if entry["expires_at"] <= now:
                    continue
                if entry["corpus_version"] != corpus_version or entry["prompt_version"] != prompt_version:
                    continue

                return entry
        return None

    async def find_semantic_candidate(
        self,
        tenant_id: str,
        security_scope: str,
        query_embedding: List[float],
        corpus_version: str,
        prompt_version: str,
        similarity_threshold: float
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Tier 2: Semantic vector candidate search.
        Strictly partitions by tenant_id, security_scope, and validates freshness tags.
        """
        best_candidate: Optional[Dict[str, Any]] = None
        best_score = -1.0
        now = datetime.now(timezone.utc)

        for entry in self._entries.values():
            # Strict tenant and security scope boundary
            if entry["tenant_id"] != tenant_id or entry["security_scope"] != security_scope:
                continue

            # Check expiration TTL
            if entry["expires_at"] <= now:
                continue

            # Check corpus and prompt version freshness
            if entry["corpus_version"] != corpus_version or entry["prompt_version"] != prompt_version:
                continue

            score = self._cosine_similarity(query_embedding, entry["query_embedding"])
            if score > best_score:
                best_score = score
                best_candidate = entry

        if best_candidate and best_score >= similarity_threshold:
            return best_candidate, round(best_score, 4)

        return None

    async def save_entry(self, entry: Dict[str, Any]) -> None:
        """Store cache entry in memory and attempt Redis tier sync."""
        self._entries[entry["id"]] = entry
        try:
            redis = await get_redis_client()
            await redis.set(
                f"exact:{entry['cache_key']}",
                entry["id"],
                ex=entry["ttl_seconds"]
            )
        except Exception as e:
            logger.debug(f"Redis tier sync skipped: {e}")

    async def record_hit(self, entry_id: str, is_exact: bool, avoided_cost: float = 0.0) -> None:
        """Increment hit count and update metrics."""
        if is_exact:
            self._exact_hits += 1
        else:
            self._semantic_hits += 1
        self._estimated_cost_avoided += avoided_cost

        if entry_id in self._entries:
            self._entries[entry_id]["hit_count"] += 1
            self._entries[entry_id]["last_accessed_at"] = datetime.now(timezone.utc)

    def record_miss(self) -> None:
        self._misses += 1

    def record_bypass(self) -> None:
        self._bypasses += 1

    async def invalidate(
        self,
        tenant_id: str,
        security_scope: Optional[str] = None,
        corpus_version: Optional[str] = None
    ) -> int:
        """Invalidate and purge cache entries matching the specified filter criteria."""
        to_delete = []
        for eid, entry in self._entries.items():
            if entry["tenant_id"] != tenant_id:
                continue
            if security_scope and entry["security_scope"] != security_scope:
                continue
            if corpus_version and entry["corpus_version"] != corpus_version:
                continue
            to_delete.append(eid)

        for eid in to_delete:
            del self._entries[eid]

        logger.info(f"Invalidated {len(to_delete)} cache entries for tenant={tenant_id}, scope={security_scope}")
        return len(to_delete)

    async def list_entries(self, tenant_id: str) -> List[Dict[str, Any]]:
        """List cache entries for authorized tenant inspection."""
        results = [e for e in self._entries.values() if e["tenant_id"] == tenant_id]
        return sorted(results, key=lambda x: x["last_accessed_at"], reverse=True)

    def get_metrics(self) -> Dict[str, Any]:
        """Aggregate cache telemetry and hit rate statistics."""
        total_hits = self._exact_hits + self._semantic_hits
        total_evals = total_hits + self._misses
        hit_rate = round((total_hits / total_evals * 100), 2) if total_evals > 0 else 0.0

        return {
            "total_entries": len(self._entries),
            "exact_hit_count": self._exact_hits,
            "semantic_hit_count": self._semantic_hits,
            "miss_count": self._misses,
            "bypass_count": self._bypasses,
            "hit_rate_percentage": hit_rate,
            "estimated_cost_avoided_usd": round(self._estimated_cost_avoided, 6),
            "is_authoritative_billing": False
        }


# Singleton instance
_cache_repo = CacheRepository()


def get_cache_repository() -> CacheRepository:
    return _cache_repo
