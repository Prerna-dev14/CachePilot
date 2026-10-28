"""Integration tests for RAG document ingestion and query workflow."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_document_ingestion_and_query_flow(async_client: AsyncClient):
    # 1. Ingest sample document
    ingest_payload = {
        "title": "Cache Invalidation RFC",
        "content": (
            "CachePilot semantic cache entries are explicitly tagged with corpus version. "
            "When documents change, the version increments and stale cache entries expire immediately."
        ),
        "tenant_id": "tenant-test-rag",
        "security_scope": "default",
        "metadata": {"author": "ArchTeam"}
    }

    ingest_resp = await async_client.post("/api/v1/documents", json=ingest_payload)
    assert ingest_resp.status_code == 201
    doc_data = ingest_resp.json()
    assert doc_data["title"] == "Cache Invalidation RFC"
    assert doc_data["chunk_count"] >= 1
    assert "document_id" in doc_data
    doc_id = doc_data["document_id"]

    # 2. List documents
    list_resp = await async_client.get("/api/v1/documents?tenant_id=tenant-test-rag")
    assert list_resp.status_code == 200
    docs_list = list_resp.json()
    assert any(d["document_id"] == doc_id for d in docs_list)

    # 3. Execute RAG query against ingested document
    query_payload = {
        "query": "How are stale cache entries handled when documents change?",
        "tenant_id": "tenant-test-rag",
        "security_scope": "default",
        "top_k": 3,
        "bypass_cache": False
    }

    query_resp = await async_client.post("/api/v1/query", json=query_payload)
    assert query_resp.status_code == 200
    res_data = query_resp.json()

    # Verify response structure
    assert "answer" in res_data
    assert "citations" in res_data
    assert len(res_data["citations"]) > 0
    assert res_data["citations"][0]["document_id"] == doc_id
    assert res_data["citations"][0]["score"] > 0.0

    # Verify telemetry breakdown
    telemetry = res_data["telemetry"]
    assert telemetry["cache_status"] in {"MISS", "BYPASS"}
    assert telemetry["route"] == "small"
    assert telemetry["tokens"]["total_tokens"] > 0
    assert telemetry["estimated_cost_usd"] > 0
    assert telemetry["is_authoritative_billing"] is False
    assert telemetry["latencies_ms"]["retrieval"] >= 0.0
    assert telemetry["latencies_ms"]["generation"] >= 0.0
    assert telemetry["latencies_ms"]["total"] >= telemetry["latencies_ms"]["retrieval"]
