"""Security test: verify tenant isolation and prevention of cache/retrieval leakage."""
import pytest
from backend.app.schemas.rag import DocumentIngestRequest, QueryRequest
from backend.app.services.rag_service import RAGPipelineService
from backend.app.repositories.document_repository import DocumentRepository


@pytest.mark.asyncio
async def test_cross_tenant_retrieval_isolation():
    # Use isolated repository instance for clean test assertions
    repo = DocumentRepository()
    service = RAGPipelineService(repository=repo)

    # 1. Ingest secret document for Tenant Finance
    finance_req = DocumentIngestRequest(
        title="Q3 Confidential Audit Ledger",
        content="The confidential expenditure for Tenant Finance in Q3 was precisely $4.5 million dollars.",
        tenant_id="tenant-finance",
        security_scope="confidential"
    )
    finance_resp = await service.ingest_document(finance_req)
    assert finance_resp.document_id

    # 2. Ingest public document for Default Tenant
    default_req = DocumentIngestRequest(
        title="Public Employee Handbook",
        content="Office working hours are 9:00 AM to 5:00 PM Monday through Friday.",
        tenant_id="tenant-default",
        security_scope="default"
    )
    await service.ingest_document(default_req)

    # 3. Query from Tenant Default targeting the secret finance expenditure
    adversarial_query = QueryRequest(
        query="What was the confidential expenditure for Tenant Finance in Q3?",
        tenant_id="tenant-default",
        security_scope="default",
        top_k=5
    )

    query_resp = await service.run_query(adversarial_query, request_id="test-isolation-req-1")

    # 4. Critical assertion: verify Tenant Finance document is NEVER present in citations
    retrieved_doc_ids = [c.document_id for c in query_resp.citations]
    assert finance_resp.document_id not in retrieved_doc_ids

    for citation in query_resp.citations:
        assert "$4.5 million" not in citation.text_snippet
        assert citation.document_title != "Q3 Confidential Audit Ledger"

    # 5. Query from Tenant Finance with proper scope retrieves the document
    authorized_query = QueryRequest(
        query="What was the confidential expenditure for Tenant Finance in Q3?",
        tenant_id="tenant-finance",
        security_scope="confidential",
        top_k=5
    )
    auth_resp = await service.run_query(authorized_query, request_id="test-isolation-req-2")
    auth_doc_ids = [c.document_id for c in auth_resp.citations]
    assert finance_resp.document_id in auth_doc_ids
