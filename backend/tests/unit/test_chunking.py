"""Unit tests for text chunking and token counting."""
from backend.app.services.chunking import ChunkingService


def test_chunking_empty_string():
    chunker = ChunkingService(chunk_size=100, chunk_overlap=20)
    assert chunker.split_text("") == []
    assert chunker.split_text("   \n\t  ") == []


def test_chunking_short_text():
    chunker = ChunkingService(chunk_size=200, chunk_overlap=30)
    text = "CachePilot is an observable RAG gateway."
    chunks = chunker.split_text(text)

    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].text == text
    assert chunks[0].token_count > 0


def test_chunking_long_text_overlap():
    chunker = ChunkingService(chunk_size=100, chunk_overlap=20)
    text = (
        "Retrieval-Augmented Generation (RAG) applications combine external knowledge retrieval "
        "with large language model inference. CachePilot adds scope-aware semantic caching "
        "and policy-based cost routing to reduce redundant queries and save money."
    )
    chunks = chunker.split_text(text)

    assert len(chunks) > 1
    for i, c in enumerate(chunks):
        assert c.index == i
        assert len(c.text) <= 120  # bounded chunk size


def test_token_estimation():
    text = "Hello world from CachePilot"
    tokens = ChunkingService.estimate_tokens(text)
    assert tokens >= 4
