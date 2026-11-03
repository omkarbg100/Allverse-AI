"""
Embedding model — uses the single installed Ollama model (llama3.2:3b).
Used by the PDF RAG agent for document chunking + similarity search.
"""

from langchain_ollama import OllamaEmbeddings
from .settings import settings

embeddings = OllamaEmbeddings(
    model=settings.OLLAMA_EMBED_MODEL,
    base_url=settings.OLLAMA_HOST,
)

