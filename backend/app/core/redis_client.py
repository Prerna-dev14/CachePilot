"""Redis client management and health checks with in-memory fallback."""
import time
import logging
from typing import Optional, Dict, Any
import redis.asyncio as aioredis
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class InMemoryCacheFallback:
    """In-memory key-value fallback when Redis is offline or during testing."""

    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._ttls: Dict[str, float] = {}

    async def ping(self) -> bool:
        return True

    async def get(self, key: str) -> Optional[str]:
        if key in self._ttls and time.time() > self._ttls[key]:
            del self._store[key]
            del self._ttls[key]
            return None
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        if ex:
            self._ttls[key] = time.time() + ex
        elif key in self._ttls:
            del self._ttls[key]
        return True

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                count += 1
            if k in self._ttls:
                del self._ttls[k]
        return count

    async def flushdb(self) -> bool:
        self._store.clear()
        self._ttls.clear()
        return True

    async def aclose(self) -> None:
        pass


_redis_client = None
_in_memory_fallback = InMemoryCacheFallback()


async def get_redis_client():
    """Retrieve async Redis client or fallback."""
    global _redis_client
    if _redis_client is None:
        try:
            client = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0
            )
            # Quick check
            await client.ping()
            _redis_client = client
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}). Using in-memory cache fallback.")
            return _in_memory_fallback
    return _redis_client


async def check_redis_health() -> Dict[str, Any]:
    """Verify Redis readiness or in-memory fallback status."""
    start_time = time.perf_counter()
    try:
        client = await get_redis_client()
        await client.ping()
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        is_fallback = isinstance(client, InMemoryCacheFallback)
        return {
            "status": "connected" if not is_fallback else "fallback_in_memory",
            "latency_ms": latency_ms,
            "mode": "redis" if not is_fallback else "in_memory"
        }
    except Exception as e:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "error": str(e)
        }
