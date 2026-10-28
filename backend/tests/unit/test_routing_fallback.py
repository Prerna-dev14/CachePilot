"""Unit tests for resilient model execution and automatic provider fallback."""
import pytest
from unittest.mock import patch
from backend.app.schemas.rag import QueryRequest, DocumentIngestRequest
from backend.app.services.rag_service import RAGPipelineService
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.repositories.cache_repository import CacheRepository
from backend.app.services.semantic_cache_service import SemanticCacheService
from backend.app.adapters.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_automatic_large_fallback_on_small_model_error():
    doc_repo = DocumentRepository()
    cache_repo = CacheRepository()
    cache_service = SemanticCacheService(repository=cache_repo)
    rag_service = RAGPipelineService(repository=doc_repo, cache_service=cache_service)

    # Ingest document
    await rag_service.ingest_document(DocumentIngestRequest(
        title="Network Policy",
        content="Standard ingress port is 8000.",
        tenant_id="tenant-fallback",
        security_scope="default"
    ))

    # A simple query that routes to small model
    query_req = QueryRequest(
        query="What is the ingress port?",
        tenant_id="tenant-fallback",
        security_scope="default",
        bypass_cache=True  # Ensure generation is triggered
    )

    # Patch get_llm_provider so small model simulates a failure, while large succeeds
    from backend.app.services import rag_service as rag_module

    original_get_llm = rag_module.get_llm_provider

    def mock_get_llm(model_name=None, **kwargs):
        if model_name == "mock-fast-small":
            return MockLLMProvider(model_name="mock-fast-small", simulate_failure=True)
        return original_get_llm(model_name=model_name, **kwargs)

    with patch.object(rag_module, "get_llm_provider", side_effect=mock_get_llm):
        resp = await rag_service.run_query(query_req, request_id="req-fallback-test")

        # Assertions: Small model failed, large model handled request successfully
        assert resp.answer
        assert resp.telemetry.route == "large"
        assert resp.telemetry.route_reason == "FALLBACK_RETRY"
        assert resp.telemetry.tokens.total_tokens > 0
