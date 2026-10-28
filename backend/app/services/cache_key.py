"""Query normalization and scope-aware cache key computation."""
import hashlib
import re
from typing import Dict, Any, Optional


def normalize_query_text(query: str) -> str:
    """
    Deterministically normalize query text:
    - Lowercase
    - Strip leading/trailing whitespaces
    - Collapse multiple whitespace/newlines
    - Strip trailing question marks/punctuation for canonical matching
    """
    if not query:
        return ""
    q = query.strip().lower()
    # Normalize punctuation spacing
    q = re.sub(r'[\?\.\!]+$', '', q)
    # Collapse multiple whitespaces
    q = re.sub(r'\s+', ' ', q).strip()
    return q


def compute_generation_params_hash(params: Optional[Dict[str, Any]] = None) -> str:
    """Compute deterministic MD5 of generation parameters that alter answer validity."""
    if not params:
        return "default"
    # Sort keys for deterministic representation
    sorted_items = sorted((str(k), str(v)) for k, v in params.items())
    raw_repr = "&".join(f"{k}={v}" for k, v in sorted_items)
    return hashlib.md5(raw_repr.encode("utf-8")).hexdigest()[:10]


def generate_scope_aware_cache_key(
    tenant_id: str,
    security_scope: str,
    normalized_query: str,
    embedding_model_version: str,
    corpus_version: str,
    prompt_version: str,
    generation_params_hash: str = "default"
) -> str:
    """
    Formulate cryptographic SHA-256 cache key strictly scoped by tenant and security boundary:
    cache_key = SHA256(
        tenant_id + ":" +
        security_scope + ":" +
        normalized_query + ":" +
        embedding_model_version + ":" +
        corpus_version + ":" +
        prompt_version + ":" +
        generation_params_hash
    )
    """
    raw_payload = (
        f"{tenant_id}:"
        f"{security_scope}:"
        f"{normalized_query}:"
        f"{embedding_model_version}:"
        f"{corpus_version}:"
        f"{prompt_version}:"
        f"{generation_params_hash}"
    )
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()
