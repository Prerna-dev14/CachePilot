"""RAG Pipeline Service orchestrating semantic caching, complexity-based model routing, and the usage ledger."""
import hashlib
import time
import uuid
import logging
from typing import List, Optional
from backend.app.schemas.rag import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    DocumentSummary,
    QueryRequest,
    QueryResponse,
    Citation,
    QueryTelemetry,
    TokenUsage,
    LatencyBreakdown,
)
from backend.app.services.chunking import ChunkingService
from backend.app.services.semantic_cache_service import SemanticCacheService
from backend.app.services.router_service import RouterService
from backend.app.services.ledger_service import LedgerService
from backend.app.repositories.document_repository import get_document_repository, DocumentRepository
from backend.app.adapters.factory import get_llm_provider, get_embedding_provider
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)


class RAGPipelineService:
    """Core RAG orchestration service with integrated semantic cache and cost-aware router."""

    def __init__(
        self,
        repository: Optional[DocumentRepository] = None,
        cache_service: Optional[SemanticCacheService] = None,
        router_service: Optional[RouterService] = None,
        ledger_service: Optional[LedgerService] = None,
        chunk_size: int = 500,
        chunk_overlap: int = 60
    ):
        self.repo = repository or get_document_repository()
        self.cache = cache_service or SemanticCacheService()
        self.router = router_service or RouterService()
        self.ledger = ledger_service or LedgerService()
        self.chunker = ChunkingService(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.settings = get_settings()

    async def ingest_document(self, req: DocumentIngestRequest) -> DocumentIngestResponse:
        """Ingest a text document, chunk it, compute vector embeddings, and persist."""
        doc_id = f"doc-{uuid.uuid4().hex[:10]}"
        content_hash = hashlib.sha256(req.content.strip().encode("utf-8")).hexdigest()

        # 1. Chunk document
        chunks = self.chunker.split_text(req.content)
        if not chunks:
            raise ValueError("Document content must contain non-empty text")

        # 2. Compute embeddings via configured embedding provider
        embedder = get_embedding_provider()
        chunk_texts = [c.text for c in chunks]
        embeddings = await embedder.embed_documents(chunk_texts)

        # 3. Store document metadata
        await self.repo.create_document(
            doc_id=doc_id,
            tenant_id=req.tenant_id,
            security_scope=req.security_scope,
            title=req.title,
            content_hash=content_hash,
            metadata=req.metadata,
            corpus_version=self.settings.corpus_version
        )

        # 4. Store chunks with embeddings
        chunk_records = []
        for i, c in enumerate(chunks):
            chunk_records.append({
                "id": f"chk-{doc_id}-{i}",
                "document_id": doc_id,
                "tenant_id": req.tenant_id,
                "security_scope": req.security_scope,
                "chunk_index": c.index,
                "text": c.text,
                "embedding": embeddings[i],
                "token_count": c.token_count,
            })
        await self.repo.create_chunks(chunk_records)

        logger.info(
            f"Ingested document {doc_id} ('{req.title}') with {len(chunks)} chunks for tenant={req.tenant_id}, scope={req.security_scope}"
        )

        return DocumentIngestResponse(
            document_id=doc_id,
            title=req.title,
            tenant_id=req.tenant_id,
            security_scope=req.security_scope,
            chunk_count=len(chunks),
            content_hash=content_hash,
            corpus_version=self.settings.corpus_version,
            created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        )

    async def list_documents(
        self,
        tenant_id: str,
        security_scope: Optional[str] = None
    ) -> List[DocumentSummary]:
        """List documents visible to the specified tenant/scope."""
        return await self.repo.list_documents(tenant_id=tenant_id, security_scope=security_scope)

    async def run_query(self, req: QueryRequest, request_id: str) -> QueryResponse:
        """
        Execute RAG query with semantic cache check and policy-based model routing:
        1. Evaluate semantic cache (Tier 1 exact match & Tier 2 vector similarity).
        2. If hit: return cached answer immediately with 0 token cost and fast latency.
        3. If miss/bypass:
           a. Retrieve top-k chunks bounded by tenant & security scope.
           b. Classify query complexity -> select small model or large reasoning model.
           c. Generate answer, executing automatic large fallback if small model errors.
           d. Store in cache & commit transaction to usage ledger.
        """
        total_start = time.perf_counter()

        # Step 1: Semantic Cache Evaluation
        cache_result = await self.cache.lookup(
            query=req.query,
            tenant_id=req.tenant_id,
            security_scope=req.security_scope,
            similarity_threshold=req.similarity_threshold,
            bypass_cache=req.bypass_cache
        )

        # On valid cache HIT: return stored response immediately
        if cache_result.hit and cache_result.entry:
            total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            telemetry = QueryTelemetry(
                cache_status=cache_result.cache_status,
                similarity_score=cache_result.similarity_score,
                route="cache",
                route_reason=f"SEMANTIC_CACHE_{cache_result.cache_status}",
                tokens=TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
                estimated_cost_usd=0.0,
                is_authoritative_billing=False,
                latencies_ms=LatencyBreakdown(
                    cache_lookup=cache_result.latency_ms,
                    retrieval=0.0,
                    generation=0.0,
                    total=total_duration_ms
                )
            )
            response = QueryResponse(
                request_id=request_id,
                query=req.query,
                answer=cache_result.entry.response_text,
                citations=cache_result.entry.citations,
                telemetry=telemetry
            )

            # Record in Ledger
            await self.ledger.record_transaction(
                request_id=request_id,
                tenant_id=req.tenant_id,
                security_scope=req.security_scope,
                query=req.query,
                response=response,
                model_name="cache"
            )

            return response

        # Step 2: Cache MISS or BYPASS -> Vector Retrieval
        retrieval_start = time.perf_counter()
        embedder = get_embedding_provider()
        query_vec = await embedder.embed_query(req.query)

        candidates = await self.repo.search_similar_chunks(
            tenant_id=req.tenant_id,
            security_scope=req.security_scope,
            query_embedding=query_vec,
            top_k=req.top_k
        )
        retrieval_duration_ms = round((time.perf_counter() - retrieval_start) * 1000, 2)

        # Assemble citations and count context tokens
        citations: List[Citation] = []
        context_parts = []
        total_context_tokens = 0

        for cand in candidates:
            citations.append(Citation(
                document_id=cand["document_id"],
                chunk_id=cand["chunk_id"],
                document_title=cand["document_title"],
                score=cand["score"],
                text_snippet=cand["text"][:200]
            ))
            context_parts.append(
                f"[Source: {cand['document_title']} (Chunk: {cand['chunk_id']})]\n{cand['text']}"
            )
            total_context_tokens += len(cand["text"].split())

        context_str = "\n\n".join(context_parts) if context_parts else "No relevant context found."

        # Step 3: Cost-Aware Router: Classify query complexity
        route_decision = self.router.route_query(
            query=req.query,
            context_token_estimate=total_context_tokens
        )
        selected_model = route_decision.model_name
        route_tier = route_decision.tier
        route_reason = route_decision.reason_code

        # Step 4: Grounded Prompt Assembly
        system_prompt = (
            "You are CachePilot, an accurate and grounded enterprise assistant. "
            "Answer the user query based ONLY on the provided context evidence. "
            "If the context does not contain enough information to answer, state clearly that the answer is not available in the ingested documents. "
            "Always cite the source document title when providing facts."
        )

        user_prompt = f"Context Evidence:\n{context_str}\n\nUser Question:\n{req.query}"

        # Step 5: Generation with Resilient Fallback Handling
        gen_start = time.perf_counter()
        try:
            llm = get_llm_provider(model_name=selected_model)
            llm_resp = await llm.generate(prompt=user_prompt, system=system_prompt)
        except Exception as e:
            if selected_model == self.settings.small_model_name and self.settings.fallback_to_large_on_error:
                logger.warning(
                    f"Small model '{selected_model}' invocation failed ({e}). Executing automatic fallback to large model."
                )
                selected_model = self.settings.large_model_name
                route_tier = "large"
                route_reason = "FALLBACK_RETRY"
                fallback_llm = get_llm_provider(model_name=selected_model)
                llm_resp = await fallback_llm.generate(prompt=user_prompt, system=system_prompt)
            else:
                logger.error(f"Model generation error on '{selected_model}': {e}")
                raise

        gen_duration_ms = round((time.perf_counter() - gen_start) * 1000, 2)

        # Step 6: Write to cache if not bypassed
        if cache_result.cache_status != "BYPASS":
            await self.cache.write(
                query=req.query,
                tenant_id=req.tenant_id,
                security_scope=req.security_scope,
                response_text=llm_resp.text,
                citations=citations,
                query_embedding=query_vec,
                estimated_cost_usd=llm_resp.estimated_cost_usd
            )

        total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)

        telemetry = QueryTelemetry(
            cache_status=cache_result.cache_status,
            similarity_score=candidates[0]["score"] if candidates else 0.0,
            route=route_tier,
            route_reason=route_reason,
            tokens=TokenUsage(
                prompt_tokens=llm_resp.prompt_tokens,
                completion_tokens=llm_resp.completion_tokens,
                total_tokens=llm_resp.total_tokens
            ),
            estimated_cost_usd=llm_resp.estimated_cost_usd,
            is_authoritative_billing=False,
            latencies_ms=LatencyBreakdown(
                cache_lookup=cache_result.latency_ms,
                retrieval=retrieval_duration_ms,
                generation=gen_duration_ms,
                total=total_duration_ms
            )
        )

        response = QueryResponse(
            request_id=request_id,
            query=req.query,
            answer=llm_resp.text,
            citations=citations,
            telemetry=telemetry
        )

        # Step 7: Record Transaction in Usage Ledger
        await self.ledger.record_transaction(
            request_id=request_id,
            tenant_id=req.tenant_id,
            security_scope=req.security_scope,
            query=req.query,
            response=response,
            model_name=selected_model
        )

        return response
