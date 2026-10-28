"""RAG Document Ingestion and Query Endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Request, Query, status
from backend.app.schemas.rag import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    DocumentSummary,
    QueryRequest,
    QueryResponse,
)
from backend.app.services.rag_service import RAGPipelineService

router = APIRouter(prefix="/api/v1", tags=["RAG Pipeline"])
_rag_service = RAGPipelineService()


@router.post(
    "/documents",
    response_model=DocumentIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest Document",
    description="Chunk text document, calculate 1536-dimensional embeddings, and store under scoped tenant."
)
async def ingest_document(req: DocumentIngestRequest) -> DocumentIngestResponse:
    return await _rag_service.ingest_document(req)


@router.get(
    "/documents",
    response_model=List[DocumentSummary],
    summary="List Scoped Documents",
    description="List all ingested documents strictly filtered by tenant and optional security scope."
)
async def list_documents(
    tenant_id: str = Query(default="tenant-default", description="Tenant isolation scope"),
    security_scope: Optional[str] = Query(default=None, description="Security boundary scope")
) -> List[DocumentSummary]:
    return await _rag_service.list_documents(tenant_id=tenant_id, security_scope=security_scope)


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Execute RAG Query",
    description="Run similarity retrieval, assemble grounded prompt with citations, generate answer, and return telemetry."
)
async def execute_query(req: QueryRequest, request: Request) -> QueryResponse:
    request_id = getattr(request.state, "request_id", "req-unknown")
    return await _rag_service.run_query(req, request_id=request_id)
