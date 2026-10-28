"""API Middlewares for correlation ID propagation and structured request metrics."""
import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from backend.app.core.logging import set_correlation_id, get_correlation_id

logger = logging.getLogger("cachepilot.api")


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
