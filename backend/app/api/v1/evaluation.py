"""API Endpoints for Offline Quality Evaluation and Performance Benchmarking."""
from fastapi import APIRouter, Query
from backend.app.schemas.evaluation import BenchmarkRunResponse
from backend.app.services.evaluation_service import get_evaluation_service

router = APIRouter(prefix="/api/v1/evaluation", tags=["Evaluation & Benchmarking"])
_eval_service = get_evaluation_service()


@router.get(
    "/benchmark",
    response_model=BenchmarkRunResponse,
    summary="Get Evaluation Benchmark",
    description="Returns pre-calculated comparative evaluation benchmark comparing Baseline RAG against CachePilot."
)
async def get_benchmark(
    tenant_id: str = Query(default="tenant-default", description="Tenant ID")
) -> BenchmarkRunResponse:
    return _eval_service.run_benchmark(tenant_id=tenant_id)


@router.post(
    "/run",
    response_model=BenchmarkRunResponse,
    summary="Run Evaluation Benchmark",
    description="Executes fixed representative evaluation suite and computes cost, latency, and quality differences."
)
async def run_benchmark(
    tenant_id: str = Query(default="tenant-default", description="Tenant ID")
) -> BenchmarkRunResponse:
    return _eval_service.run_benchmark(tenant_id=tenant_id)
