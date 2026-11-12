"""
Qdrant vector store helper.
Creates an embedded collection from documents and returns the store.
"""

import asyncio

from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore

from .embeddings import get_embeddings
from .settings import settings


async def build_vector_store(
    docs: list[Document],
    collection_name: str,
    *,
    force_recreate: bool = False,
) -> QdrantVectorStore:
    """
    Embed docs and store them in Qdrant under collection_name.
    force_recreate drops any existing collection first.
    """
    embeddings = await asyncio.to_thread(get_embeddings)
    store = await QdrantVectorStore.afrom_documents(
        documents=docs,
        embedding=embeddings,
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY or None,
        collection_name=collection_name,
        force_recreate=force_recreate,
    )
    return store
