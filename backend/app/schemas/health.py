"""Pydantic schemas for health and readiness endpoints."""
from datetime import datetime, timezone
from typing import Dict, Optional, Any
from pydantic import BaseModel, Field


class HealthLiveResponse(BaseModel):
    """Liveness probe response model."""
    status: str = Field(default="healthy", description="Process liveness status")
    service: str = Field(default="cachepilot", description="Service identifier")
    version: str = Field(default="1.0.0", description="Application semantic version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DependencyStatus(BaseModel):
    """Status details for an individual infrastructure dependency."""
    status: str = Field(description="State of dependency e.g. connected, fallback_in_memory, unhealthy")
    latency_ms: Optional[float] = Field(default=None, description="Roundtrip check latency in ms")
    error: Optional[str] = Field(default=None, description="Error message if unhealthy")
    mode: Optional[str] = Field(default=None, description="Operating mode e.g. redis or in_memory")


class HealthReadyResponse(BaseModel):
    """Readiness probe response model."""
    status: str = Field(description="ready or degraded/unhealthy")
    dependencies: Dict[str, DependencyStatus] = Field(description="Status of all critical dependencies")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    config_summary: Optional[Dict[str, Any]] = Field(default=None, description="Safe diagnostics summary")
