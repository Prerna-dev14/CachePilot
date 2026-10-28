"""Unit tests for query normalization and scope-aware cache keys."""
from backend.app.services.cache_key import (
    normalize_query_text,
    generate_scope_aware_cache_key,
    compute_generation_params_hash,
)


def test_query_normalization():
    q1 = "What is the CachePilot retention policy???"
    q2 = "  what is the cachepilot   retention policy   "
    assert normalize_query_text(q1) == normalize_query_text(q2)
    assert normalize_query_text(q1) == "what is the cachepilot retention policy"


def test_cache_key_scope_isolation():
    norm_q = "what is the cache policy"
    key_tenant_a = generate_scope_aware_cache_key(
        tenant_id="tenant-alpha",
        security_scope="default",
        normalized_query=norm_q,
        embedding_model_version="mock-embed-v1",
        corpus_version="v1.0.0",
        prompt_version="v1.0.0"
    )

    key_tenant_b = generate_scope_aware_cache_key(
        tenant_id="tenant-beta",
        security_scope="default",
        normalized_query=norm_q,
        embedding_model_version="mock-embed-v1",
        corpus_version="v1.0.0",
        prompt_version="v1.0.0"
    )

    assert key_tenant_a != key_tenant_b


def test_cache_key_version_sensitivity():
    norm_q = "how to invalidate cache"
    key_v1 = generate_scope_aware_cache_key(
        tenant_id="tenant-alpha",
        security_scope="default",
        normalized_query=norm_q,
        embedding_model_version="mock-embed-v1",
        corpus_version="v1.0.0",
        prompt_version="v1.0.0"
    )

    key_v2 = generate_scope_aware_cache_key(
        tenant_id="tenant-alpha",
        security_scope="default",
        normalized_query=norm_q,
        embedding_model_version="mock-embed-v1",
        corpus_version="v1.0.1",  # Changed corpus version
        prompt_version="v1.0.0"
    )

    assert key_v1 != key_v2
