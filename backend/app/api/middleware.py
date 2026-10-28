"""API Middlewares for correlation ID propagation and structured request metrics."""
import time
import uuid
import logging
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from backend.app.core.logging import set_correlation_id, get_correlation_id
from backend.app.core.config import get_settings

logger = logging.getLogger("cachepilot.api")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window rate limiter per client IP/key."""

    def __init__(self, app, requests_per_minute: int = 120, enabled: bool = True):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.enabled = enabled
        self._history: Dict[str, List[float]] = {}

    def _clean_old_requests(self, client_id: str, now: float) -> List[float]:
        window_start = now - 60.0
        timestamps = [t for t in self._history.get(client_id, []) if t > window_start]
        self._history[client_id] = timestamps
        return timestamps

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.enabled:
            return await call_next(request)

        # Exempt health probes from rate limits
        if request.url.path.startswith("/health"):
            return await call_next(request)

        client_ip = request.headers.get(
            "X-Forwarded-For",
            request.client.host if request.client else "unknown"
        ).split(",")[0].strip()
        client_key = request.headers.get("X-API-Key", client_ip)
        now = time.time()

        recent = self._clean_old_requests(client_key, now)

        if len(recent) >= self.requests_per_minute:
            request_id = getattr(request.state, "request_id", get_correlation_id() or "unknown")
            logger.warning(
                f"Rate limit exceeded for client {client_key} ({len(recent)} requests/min)",
                extra={"correlation_id": request_id}
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "TooManyRequests",
                    "message": f"Rate limit exceeded. Maximum allowed is {self.requests_per_minute} requests per minute.",
                    "request_id": request_id
                },
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": "0"
                }
            )

        self._history.setdefault(client_key, []).append(now)
        remaining = max(0, self.requests_per_minute - len(self._history[client_key]))

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response



class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Ensure every HTTP request has an X-Request-ID and tracks it in async context."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Check client header or generate new UUID
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = f"cpilot-{uuid.uuid4().hex[:12]}"

        # Store in context variable for logging
        set_correlation_id(request_id)

        # Store on request state for endpoint handlers
        request.state.request_id = request_id

        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time-Ms"] = str(duration_ms)

            # Avoid logging verbose health poll lines in INFO if desired, or log with duration
            if not request.url.path.startswith("/health/live"):
                logger.info(
                    f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)",
                    extra={"correlation_id": request_id}
                )
            return response
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled error processing {request.method} {request.url.path}: {e}",
                exc_info=True,
                extra={"correlation_id": request_id}
            )
            raise
