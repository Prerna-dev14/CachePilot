"""Text chunking and token estimation service."""
import re
from typing import List
from pydantic import BaseModel, Field


class TextChunk(BaseModel):
    index: int
    text: str
    token_count: int = Field(ge=0)


class ChunkingService:
    """Splits long texts into semantically coherent overlapping chunks."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 60):
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Heuristic token estimation (~4 characters per token)."""
        if not text:
            return 0
        words = len(text.split())
        chars = len(text)
        return max(words, int(chars / 4))

    def split_text(self, text: str) -> List[TextChunk]:
        """Split text into chunks with bounded overlap."""
        cleaned_text = text.strip()
        if not cleaned_text:
            return []

        if len(cleaned_text) <= self.chunk_size:
            return [TextChunk(index=0, text=cleaned_text, token_count=self.estimate_tokens(cleaned_text))]

        chunks: List[TextChunk] = []
        start = 0
        idx = 0
        text_len = len(cleaned_text)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunk_slice = cleaned_text[start:text_len].strip()
                if chunk_slice:
                    chunks.append(TextChunk(index=idx, text=chunk_slice, token_count=self.estimate_tokens(chunk_slice)))
                break

            # Try to break on paragraph or sentence boundary
            window = cleaned_text[start:end]
            split_pos = -1

            # Look for double newline (paragraph)
            last_para = window.rfind("\n\n")
            if last_para > int(self.chunk_size * 0.4):
                split_pos = last_para + 2
            else:
                # Look for sentence boundary (.!?)
                match = re.search(r'[\.\!\?]\s+', window[int(self.chunk_size * 0.5):])
                if match:
                    split_pos = int(self.chunk_size * 0.5) + match.end()

            if split_pos == -1:
                # Fallback to whitespace
                last_space = window.rfind(" ")
                if last_space > int(self.chunk_size * 0.4):
                    split_pos = last_space + 1
                else:
                    split_pos = self.chunk_size

            chunk_slice = cleaned_text[start:start + split_pos].strip()
            if chunk_slice:
                chunks.append(TextChunk(index=idx, text=chunk_slice, token_count=self.estimate_tokens(chunk_slice)))
                idx += 1

            start = start + split_pos - self.chunk_overlap

        return chunks
