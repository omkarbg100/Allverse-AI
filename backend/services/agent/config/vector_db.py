"""
Qdrant vector store helper.
Mirrors vectorDb.js — creates a collection from documents and returns the store.
"""

from langchain_qdrant import QdrantVectorStore
from langchain_core.documents import Document
from .embeddings import embeddings
from .settings import settings


async def build_vector_store(
    docs: list[Document], collection_name: str
) -> QdrantVectorStore:
    """
    Embed docs and store them in Qdrant under collection_name.
    Returns the QdrantVectorStore instance ready for similarity search.
    """
    store = await QdrantVectorStore.afrom_documents(
        documents=docs,
        embedding=embeddings,
        url=settings.QDRANT_URL,
        collection_name=collection_name,
    )
    return store

