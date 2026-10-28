"""Security test: verify semantic cache entries cannot be reused across tenant boundaries."""
import pytest
from backend.app.schemas.rag import DocumentIngestRequest, QueryRequest
from backend.app.services.rag_service import RAGPipelineService
from backend.app.services.semantic_cache_service import SemanticCacheService
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.repositories.cache_repository import CacheRepository


@pytest.mark.asyncio
async def test_cross_tenant_cache_leakage_prevention():
    doc_repo = DocumentRepository()
    cache_repo = CacheRepository()
    cache_service = SemanticCacheService(repository=cache_repo)
    rag_service = RAGPipelineService(repository=doc_repo, cache_service=cache_service)

    # 1. Ingest document for Tenant A
    await rag_service.ingest_document(DocumentIngestRequest(
        title="Internal Tenant A Policy",
        content="Tenant A secret encryption key rotation interval is 14 days.",
        tenant_id="tenant-A",
        security_scope="default"
    ))

    # 2. Ingest document for Tenant B
    await rag_service.ingest_document(DocumentIngestRequest(
        title="Tenant B General Policy",
        content="General office guidelines for all employees.",
        tenant_id="tenant-B",
        security_scope="default"
    ))

    # 3. Query from Tenant A -> Cache MISS, writes entry into cache
    query_a = QueryRequest(
        query="What is the encryption key rotation interval?",
        tenant_id="tenant-A",
        security_scope="default"
    )
    res_a1 = await rag_service.run_query(query_a, request_id="req-a-1")
    assert res_a1.telemetry.cache_status == "MISS"

    # 4. Immediate second query from Tenant A -> Cache HIT_EXACT
    res_a2 = await rag_service.run_query(query_a, request_id="req-a-2")
    assert res_a2.telemetry.cache_status == "HIT_EXACT"
    assert res_a2.telemetry.tokens.total_tokens == 0

    # 5. Adversarial query from Tenant B with IDENTICAL question
    query_b = QueryRequest(
        query="What is the encryption key rotation interval?",
        tenant_id="tenant-B",
        security_scope="default"
    )
    res_b = await rag_service.run_query(query_b, request_id="req-b-1")

    # Critical security assertion: Tenant B MUST NOT get Tenant A's cached response!
    assert res_b.telemetry.cache_status == "MISS"
    assert res_b.telemetry.route != "cache"
    assert "Tenant A" not in res_b.answer
