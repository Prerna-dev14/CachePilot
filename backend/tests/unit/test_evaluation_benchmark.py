"""Unit tests for offline quality evaluation and benchmark runner."""
from backend.app.services.evaluation_service import EvaluationService


def test_evaluation_benchmark_execution():
    service = EvaluationService()
    result = service.run_benchmark(tenant_id="tenant-test-eval")

    assert result.total_queries == 8
    assert result.tenant_id == "tenant-test-eval"
    assert result.benchmark_dataset_version == "v1.0.0-enterprise-eval"

    # Verify cache hits were simulated
    assert result.cache_hit_count >= 2
    assert result.cache_hit_rate_percent > 0

    # Verify model mix
    assert result.small_model_route_percent > 0
    assert result.large_model_route_percent > 0

    # Verify cost and latency reductions
    assert result.total_cpilot_cost_usd < result.total_baseline_cost_usd
    assert result.overall_cost_reduction_percent > 30.0
    assert result.avg_cpilot_latency_ms < result.avg_baseline_latency_ms
    assert result.overall_latency_reduction_percent > 30.0

    # Verification of non-authoritative billing flag
    assert result.is_authoritative_billing is False

    # Verify each item structure
    for item in result.items:
        assert item.query_id.startswith("eval-")
        assert item.query
        assert item.citation_count >= 1
        assert item.grounded_faithfulness_score == 1.0
        assert item.cpilot_cost_usd <= item.baseline_cost_usd
