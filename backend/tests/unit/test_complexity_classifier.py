"""Unit tests for query complexity classification and model routing policy."""
from backend.app.services.router_service import RouterService


def test_low_complexity_direct_route():
    router = RouterService()
    query = "What is the data retention period?"
    score, signals = router.classify_complexity(query)

    assert score < 0.65
    decision = router.route_query(query)
    assert decision.tier == "small"
    assert decision.model_name == router.settings.small_model_name
    assert decision.reason_code == "LOW_COMPLEXITY_DIRECT"


def test_comparative_reasoning_high_complexity():
    router = RouterService()
    query = "Compare the differences and evaluate the tradeoffs between exact cache and vector similarity caching."
    score, signals = router.classify_complexity(query)

    assert score >= 0.65
    assert any("Comparative" in s for s in signals)

    decision = router.route_query(query)
    assert decision.tier == "large"
    assert decision.model_name == router.settings.large_model_name
    assert decision.reason_code == "REASONING_REQUIRED"


def test_multi_step_analytical_reasoning():
    router = RouterService()
    query = "Why did the system latency spike? Explain the rationale and root cause step by step."
    score, signals = router.classify_complexity(query)

    assert score >= 0.65
    assert any("Analytical" in s for s in signals)

    decision = router.route_query(query)
    assert decision.tier == "large"
    assert decision.reason_code == "REASONING_REQUIRED"


def test_quantitative_calculation_reasoning():
    router = RouterService()
    query = "Calculate the total sum and percentage ratio of quarterly capital expenditures."
    score, signals = router.classify_complexity(query)

    assert score >= 0.65
    assert any("Quantitative" in s for s in signals)

    decision = router.route_query(query)
    assert decision.tier == "large"
    assert decision.reason_code == "REASONING_REQUIRED"


def test_manual_override():
    router = RouterService()
    decision = router.route_query("simple query", forced_tier="large")
    assert decision.tier == "large"
    assert decision.reason_code == "MANUAL_OVERRIDE"
