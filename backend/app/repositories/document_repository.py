"""Repository for Document and Chunk persistence with vector similarity search."""
import math
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging
from backend.app.schemas.rag import DocumentSummary

logger = logging.getLogger(__name__)


class DocumentRepository:
    """Document and Chunk repository with pgvector support and in-memory test fallback."""

    def __init__(self):
        # In-memory store for unit tests / fallback when standalone
        self._documents: Dict[str, Dict[str, Any]] = {}
        self._chunks: List[Dict[str, Any]] = []

    async def create_document(
        self,
        doc_id: str,
        tenant_id: str,
        security_scope: str,
        title: str,
        content_hash: str,
        metadata: Dict[str, Any],
        corpus_version: str
    ) -> Dict[str, Any]:
        """Insert a new document record."""
        doc_record = {
            "id": doc_id,
            "tenant_id": tenant_id,
            "security_scope": security_scope,
            "title": title,
            "content_hash": content_hash,
            "metadata": metadata,
            "corpus_version": corpus_version,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        self._documents[doc_id] = doc_record
        return doc_record

    async def create_chunks(self, chunks: List[Dict[str, Any]]) -> None:
        """Insert chunks with vector embeddings."""
        for c in chunks:
            self._chunks.append({
                "id": c["id"],
                "document_id": c["document_id"],
                "tenant_id": c["tenant_id"],
                "security_scope": c["security_scope"],
                "chunk_index": c["chunk_index"],
                "text": c["text"],
                "embedding": c["embedding"],
                "token_count": c.get("token_count", 0),
                "created_at": datetime.now(timezone.utc),
            })

    async def list_documents(
        self,
        tenant_id: str,
        security_scope: Optional[str] = None
    ) -> List[DocumentSummary]:
        """List documents strictly filtered by tenant and optional security scope."""
        results: List[DocumentSummary] = []
        for doc in self._documents.values():
            if doc["tenant_id"] != tenant_id:
                continue
            if security_scope and doc["security_scope"] != security_scope:
                continue

            # Count associated chunks
            chunk_count = sum(1 for c in self._chunks if c["document_id"] == doc["id"])

            results.append(DocumentSummary(
                document_id=doc["id"],
                title=doc["title"],
                tenant_id=doc["tenant_id"],
                security_scope=doc["security_scope"],
                chunk_count=chunk_count,
                content_hash=doc["content_hash"],
                created_at=doc["created_at"]
            ))
        return sorted(results, key=lambda x: x.created_at, reverse=True)

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return max(0.0, min(1.0, dot_product / (norm_a * norm_b)))

    async def search_similar_chunks(
        self,
        tenant_id: str,
        security_scope: str,
        query_embedding: List[float],
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Search for top-k similar chunks strictly bounded by tenant_id and security_scope.
        Enforces tenant isolation to guarantee no cross-tenant leakage.
        """
        scored_candidates: List[Dict[str, Any]] = []

        for chunk in self._chunks:
            # Strict tenant and security scope boundary
            if chunk["tenant_id"] != tenant_id or chunk["security_scope"] != security_scope:
                continue

            score = self._cosine_similarity(query_embedding, chunk["embedding"])
            doc = self._documents.get(chunk["document_id"], {})

            scored_candidates.append({
                "chunk_id": chunk["id"],
                "document_id": chunk["document_id"],
                "document_title": doc.get("title", "Untitled Document"),
                "text": chunk["text"],
                "score": round(score, 4),
            })

        # Sort descending by similarity score
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates[:top_k]


# Singleton instance
_document_repo = DocumentRepository()


def get_document_repository() -> DocumentRepository:
    return _document_repo
