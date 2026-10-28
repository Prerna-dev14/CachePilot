"""Persistence repository for Request Telemetry Ledger and Model Usage breakdowns."""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from backend.app.schemas.routing import RequestLedgerEntry, ModelUsageRecord, RequestLedgerDetail

logger = logging.getLogger(__name__)


class LedgerRepository:
    """Stores telemetry records in memory / PostgreSQL requests table."""

    def __init__(self):
        self._requests: Dict[str, Dict[str, Any]] = {}
        self._model_usage: List[Dict[str, Any]] = []

    async def record_request(self, entry: Dict[str, Any]) -> None:
        """Record processed request into ledger."""
        self._requests[entry["request_id"]] = entry

    async def record_model_usage(self, usage: Dict[str, Any]) -> None:
        """Record model execution metrics into ledger."""
        self._model_usage.append(usage)

    async def list_requests(
        self,
        tenant_id: str,
        limit: int = 50,
        route_filter: Optional[str] = None,
        cache_filter: Optional[str] = None
    ) -> List[RequestLedgerEntry]:
        """List requests matching tenant and optional route/cache filters."""
        results: List[RequestLedgerEntry] = []
        for r in self._requests.values():
            if r["tenant_id"] != tenant_id:
                continue
            if route_filter and r["route"] != route_filter:
                continue
            if cache_filter and r["cache_status"] != cache_filter:
                continue
            results.append(RequestLedgerEntry(**r))

        return sorted(results, key=lambda x: x.created_at, reverse=True)[:limit]

    async def get_request_detail(self, request_id: str) -> Optional[RequestLedgerDetail]:
        """Fetch request ledger detail with child model execution breakdown."""
        raw_req = self._requests.get(request_id)
        if not raw_req:
            return None

        entry = RequestLedgerEntry(**raw_req)
        usages = [ModelUsageRecord(**u) for u in self._model_usage if u["request_id"] == request_id]
        return RequestLedgerDetail(ledger_entry=entry, model_usages=usages)

    def get_summary_metrics(self, tenant_id: str) -> Dict[str, Any]:
        """Compute summary telemetry for dashboard."""
        tenant_reqs = [r for r in self._requests.values() if r["tenant_id"] == tenant_id]
        total_count = len(tenant_reqs)
        cache_hits = sum(1 for r in tenant_reqs if "HIT" in r["cache_status"])
        total_cost = sum(r.get("estimated_cost_usd", 0.0) for r in tenant_reqs)

        latencies = [r.get("latency_total_ms", 0.0) for r in tenant_reqs]
        latencies.sort()

        p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0.0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0

        model_dist: Dict[str, int] = {}
        for r in tenant_reqs:
            rt = r.get("route", "unknown")
            model_dist[rt] = model_dist.get(rt, 0) + 1

        hit_rate = round((cache_hits / total_count * 100), 2) if total_count > 0 else 0.0

        return {
            "total_requests": total_count,
            "cache_hits": cache_hits,
            "cache_hit_rate": hit_rate,
            "estimated_total_cost_usd": round(total_cost, 6),
            "p50_latency_ms": round(p50, 2),
            "p95_latency_ms": round(p95, 2),
            "model_distribution": model_dist
        }


# Singleton instance
_ledger_repo = LedgerRepository()


def get_ledger_repository() -> LedgerRepository:
    return _ledger_repo
