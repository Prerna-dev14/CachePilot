"""Health and readiness check endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from backend.app.schemas.health import HealthLiveResponse, HealthReadyResponse, DependencyStatus
from backend.app.core.database import check_database_health
from backend.app.core.redis_client import check_redis_health
from backend.app.core.config import get_settings

router = APIRouter(prefix="/health", tags=["Health"])
settings = get_settings()


@router.get(
    "/live",
    response_model=HealthLiveResponse,
    summary="Process Liveness Probe",
    description="Returns 200 if the FastAPI application process is up and running."
)
async def health_live() -> HealthLiveResponse:
    return HealthLiveResponse(
        status="healthy",
        service="cachepilot",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc)
    )


@router.get(
    "/ready",
    response_model=HealthReadyResponse,
    summary="Dependency Readiness Probe",
    description="Verifies database and cache storage connectivity with latency measurements."
)
async def health_ready(response: Response) -> HealthReadyResponse:
    db_health = await check_database_health()
    redis_health = await check_redis_health()

    dependencies = {
        "database": DependencyStatus(
            status=db_health.get("status", "unknown"),
            latency_ms=db_health.get("latency_ms"),
            error=db_health.get("error")
        ),
        "redis": DependencyStatus(
            status=redis_health.get("status", "unknown"),
            latency_ms=redis_health.get("latency_ms"),
            error=redis_health.get("error"),
            mode=redis_health.get("mode")
        )
    }

    # System is ready if database is connected and redis is connected or functioning in fallback mode
    db_ok = db_health.get("status") == "connected"
    redis_ok = redis_health.get("status") in {"connected", "fallback_in_memory"}

    is_ready = db_ok and redis_ok

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall_status = "unhealthy"
    else:
        overall_status = "ready"

    return HealthReadyResponse(
        status=overall_status,
        dependencies=dependencies,
        timestamp=datetime.now(timezone.utc),
        config_summary=settings.safe_dump() if settings.debug or settings.environment == "development" else None
    )
