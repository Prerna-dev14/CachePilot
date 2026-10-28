"""Usage Ledger Service for recording telemetry and model financial metrics."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import logging
from backend.app.schemas.routing import RequestLedgerEntry, RequestLedgerDetail
from backend.app.schemas.rag import QueryResponse
from backend.app.repositories.ledger_repository import get_ledger_repository, LedgerRepository

logger = logging.getLogger(__name__)


class LedgerService:
    """Manages recording and querying of request telemetry and model usages."""

    def __init__(self, repository: Optional[LedgerRepository] = None):
        self.repo = repository or get_ledger_repository()

    async def record_transaction(
        self,
        request_id: str,
        tenant_id: str,
        security_scope: str,
        query: str,
        response: QueryResponse,
        model_name: str,
        provider_name: str = "mock",
        unit_cost_input: float = 0.00015,
        unit_cost_output: float = 0.00060,
        error_code: Optional[str] = None
    ) -> None:
        """Persist full request audit entry and child model usage execution record."""
        now = datetime.now(timezone.utc)
        req_entry = {
            "id": f"req-ledger-{uuid.uuid4().hex[:10]}",
            "request_id": request_id,
            "tenant_id": tenant_id,
            "security_scope": security_scope,
            "query_text": query,
            "cache_status": response.telemetry.cache_status,
            "route": response.telemetry.route,
            "route_reason": response.telemetry.route_reason,
            "prompt_tokens": response.telemetry.tokens.prompt_tokens,
            "completion_tokens": response.telemetry.tokens.completion_tokens,
            "total_tokens": response.telemetry.tokens.total_tokens,
            "estimated_cost_usd": response.telemetry.estimated_cost_usd,
            "is_authoritative_billing": False,
            "latency_cache_ms": response.telemetry.latencies_ms.cache_lookup,
            "latency_retrieval_ms": response.telemetry.latencies_ms.retrieval,
            "latency_generation_ms": response.telemetry.latencies_ms.generation,
            "latency_total_ms": response.telemetry.latencies_ms.total,
            "error_code": error_code,
            "created_at": now
        }
        await self.repo.record_request(req_entry)

        # Record child model usage if generation occurred
        if response.telemetry.tokens.total_tokens > 0:
            usage_entry = {
                "id": f"mu-{uuid.uuid4().hex[:10]}",
                "request_id": request_id,
                "model_name": model_name,
                "provider_name": provider_name,
                "prompt_tokens": response.telemetry.tokens.prompt_tokens,
                "completion_tokens": response.telemetry.tokens.completion_tokens,
                "total_tokens": response.telemetry.tokens.total_tokens,
                "unit_cost_input": unit_cost_input,
                "unit_cost_output": unit_cost_output,
                "estimated_cost_usd": response.telemetry.estimated_cost_usd,
                "latency_ms": response.telemetry.latencies_ms.generation,
                "created_at": now
            }
            await self.repo.record_model_usage(usage_entry)

    async def list_requests(
        self,
        tenant_id: str,
        limit: int = 50,
        route_filter: Optional[str] = None,
        cache_filter: Optional[str] = None
    ) -> List[RequestLedgerEntry]:
        return await self.repo.list_requests(
            tenant_id=tenant_id,
            limit=limit,
            route_filter=route_filter,
            cache_filter=cache_filter
        )

    async def get_request_detail(self, request_id: str) -> Optional[RequestLedgerDetail]:
        return await self.repo.get_request_detail(request_id)

    def get_summary_metrics(self, tenant_id: str) -> Dict[str, Any]:
        return self.repo.get_summary_metrics(tenant_id)
