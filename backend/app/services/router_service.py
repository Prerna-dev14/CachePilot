"""Query Complexity Classifier and Cost-Aware Model Router."""
import re
from typing import List, Tuple
import logging
from backend.app.schemas.routing import RouteDecision
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)


class RouterService:
    """Classifies query complexity and routes requests to cost-optimal models."""

    # Lexical triggers for multi-step reasoning
    COMPARATIVE_TRIGGERS = [
        "compare", "difference", "versus", " vs ", "tradeoff", "trade-off",
        "better than", "contrast", "pros and cons", "advantages and disadvantages"
    ]

    ANALYTICAL_REASONING_TRIGGERS = [
        "why", "how does", "explain the rationale", "step by step", "first",
        "impact of", "consequence", "synthesize", "root cause", "evaluate",
        "in-depth", "relationship between"
    ]

    QUANTITATIVE_TRIGGERS = [
        "calculate", "sum", "total", "ratio", "aggregate", "percentage",
        "capita", "formula", "mathematical"
    ]

    def __init__(self):
        self.settings = get_settings()

    def classify_complexity(self, query: str, context_token_estimate: int = 0) -> Tuple[float, List[str]]:
        """
        Analyze query and context to calculate a normalized complexity score [0.0, 1.0].
        Returns (score, detected_signals).
        """
        q_lower = query.lower().strip()
        signals: List[str] = []
        score = 0.15  # Baseline score for direct factual query

        # 1. Comparative Analysis check (+0.40 for first trigger, +0.15 for additional triggers)
        comp_count = 0
        for trig in self.COMPARATIVE_TRIGGERS:
            if trig in q_lower:
                signals.append(f"Comparative Trigger: '{trig}'")
                comp_count += 1
        if comp_count > 0:
            score += 0.40 + min(0.20, (comp_count - 1) * 0.15)

        # 2. Multi-step Analytical Reasoning check (+0.35 for first trigger, +0.15 for additional)
        ana_count = 0
        for trig in self.ANALYTICAL_REASONING_TRIGGERS:
            if trig in q_lower:
                signals.append(f"Analytical Reasoning Trigger: '{trig}'")
                ana_count += 1
        if ana_count > 0:
            score += 0.35 + min(0.25, (ana_count - 1) * 0.15)

        # 3. Quantitative / Calculations check (+0.40 for first trigger, +0.15 for additional)
        quant_count = 0
        for trig in self.QUANTITATIVE_TRIGGERS:
            if trig in q_lower:
                signals.append(f"Quantitative Calculation Trigger: '{trig}'")
                quant_count += 1
        if quant_count > 0:
            score += 0.40 + min(0.20, (quant_count - 1) * 0.15)

        # 4. Length and clause depth (> 25 words or multiple clauses -> +0.15)
        words = q_lower.split()
        if len(words) > 25:
            signals.append("Long Query (>25 words)")
            score += 0.15
        elif len(words) > 15:
            score += 0.08

        # 5. Multiple sub-questions check (multiple question marks or conjunctions)
        sub_questions = len(re.findall(r'\?', query))
        if sub_questions > 1:
            signals.append(f"Multi-Question Inquiry ({sub_questions} questions)")
            score += 0.15

        # 6. Context size pressure (> 1000 context tokens -> +0.10)
        if context_token_estimate > 1000:
            signals.append("Heavy Context (>1000 tokens)")
            score += 0.10

        normalized_score = min(1.0, round(score, 3))
        if not signals:
            signals.append("Simple Factual Lookup")

        return normalized_score, signals

    def route_query(
        self,
        query: str,
        context_token_estimate: int = 0,
        forced_tier: str = None
    ) -> RouteDecision:
        """
        Evaluate complexity against policy threshold and return RouteDecision with explicit reason code.
        """
        if forced_tier and forced_tier in {"small", "large"}:
            model_name = self.settings.small_model_name if forced_tier == "small" else self.settings.large_model_name
            return RouteDecision(
                model_name=model_name,
                tier=forced_tier,
                reason_code="MANUAL_OVERRIDE",
                complexity_score=0.5,
                complexity_reasons=["Explicitly forced tier by client"]
            )

        complexity, signals = self.classify_complexity(query, context_token_estimate)
        threshold = self.settings.routing_complexity_threshold

        if complexity >= threshold:
            # Complex reasoning -> Large frontier model
            logger.info(f"Router selected LARGE model ({self.settings.large_model_name}) [score={complexity} >= {threshold}]")
            return RouteDecision(
                model_name=self.settings.large_model_name,
                tier="large",
                reason_code="REASONING_REQUIRED",
                complexity_score=complexity,
                complexity_reasons=signals
            )
        else:
            # Simple direct factual lookup -> Small cost-effective model
            logger.info(f"Router selected SMALL model ({self.settings.small_model_name}) [score={complexity} < {threshold}]")
            return RouteDecision(
                model_name=self.settings.small_model_name,
                tier="small",
                reason_code="LOW_COMPLEXITY_DIRECT",
                complexity_score=complexity,
                complexity_reasons=signals
            )
