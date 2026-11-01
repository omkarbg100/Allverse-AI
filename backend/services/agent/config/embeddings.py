"""
Embedding model — Ollama nomic-embed-text.
Used by the PDF RAG agent for document chunking + similarity search.
"""

from langchain_ollama import OllamaEmbeddings
from .settings import settings

embeddings = OllamaEmbeddings(
    model=settings.OLLAMA_EMBED_MODEL,
    base_url=settings.OLLAMA_HOST,
)

