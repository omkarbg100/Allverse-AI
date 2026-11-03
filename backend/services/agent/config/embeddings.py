"""
Embedding model — FastEmbed (ONNX, CPU) running inside the agent container.
Used by the PDF RAG agent for chunk embedding and Qdrant similarity search.
"""

from functools import lru_cache

from langchain_community.embeddings import FastEmbedEmbeddings

from .settings import settings


@lru_cache(maxsize=1)
def get_embeddings() -> FastEmbedEmbeddings:
    """Lazily build the embedding model (downloads/caches it on first use)."""
    return FastEmbedEmbeddings(
        model_name=settings.EMBEDDING_MODEL,
        cache_dir=settings.FASTEMBED_CACHE_PATH,
    )
