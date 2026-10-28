import asyncio
import json
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.schemas.rag import DocumentIngestRequest
from backend.app.services.rag_service import RAGPipelineService


async def seed():
    sample_file = Path(__file__).resolve().parent.parent / "data" / "sample" / "documents.json"
    if not sample_file.exists():
        print(f"Sample data file not found at {sample_file}")
        return

    with open(sample_file, "r", encoding="utf-8") as f:
        docs = json.load(f)

    service = RAGPipelineService()
    print(f"Seeding {len(docs)} documents into CachePilot...")

    for item in docs:
        req = DocumentIngestRequest(
            title=item["title"],
            content=item["content"],
            tenant_id=item.get("tenant_id", "tenant-default"),
            security_scope=item.get("security_scope", "default"),
            metadata=item.get("metadata", {})
        )
        resp = await service.ingest_document(req)
        print(f"  [OK] Ingested '{resp.title}' (ID: {resp.document_id}, {resp.chunk_count} chunks, tenant: {resp.tenant_id})")

    print("Seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
