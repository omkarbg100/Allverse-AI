"""
PDF RAG Agent — mirrors agents/pdfRag.agent.js.

Flow:
  1. Read uploaded PDF with pypdf
  2. Split the pages into overlapping chunks
  3. Embed chunks with FastEmbed and index them in Qdrant
     (one collection per conversation, recreated on every upload)
  4. Retrieve the top-k chunks for the question and answer strictly from them
  5. Fall back to direct text context if embedding/retrieval fails
  6. Delete the temp file in finally block
"""

import logging
import os
import time

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from config.vector_db import build_vector_store
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
TOP_K = 5
MAX_CONTEXT_CHARS = 30000

PDF_RAG_SYSTEM = """You are Allverse AI PDF Assistant.

Rules:
- Answer ONLY from the uploaded PDF.
- Never make up information.
- If the answer is not present in the PDF, reply:
  "I couldn't find this information in the uploaded PDF."
- Use Markdown formatting.
"""


async def _retrieve_context(pages, question: str, conversation_id: str) -> str:
    """Chunk, embed, index in Qdrant, and return the top-k relevant chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(pages)
    if not chunks:
        return ""

    store = await build_vector_store(
        chunks,
        f"pdf-{conversation_id}",
        force_recreate=True,
    )
    results = await store.asimilarity_search(question, k=TOP_K)
    return "\n\n".join(doc.page_content for doc in results).strip()


async def pdf_rag_agent(state: AgentState) -> AgentState:
    file_path = state.get("file", {}).get("path") if state.get("file") else None
    try:
        await check_rate_limit(state["user_id"], "pdf")

        steps = list(state.get("steps") or [])
        steps.append({"step": "reading_source", "ts": time.time()})

        loader = PyPDFLoader(file_path)
        pages = loader.load()
        text = "\\n\\n".join(page.page_content for page in pages).strip()
        if not text:
            return {
                **state,
                "ai_response": "I couldn't extract any text from the uploaded PDF. It may be a scanned document.",
                "steps": steps,
            }

        conversation_id = state.get("conversation_id") or "default"
        steps.append({"step": "retrieving_context", "ts": time.time()})
        try:
            context = await _retrieve_context(pages, state["prompt"], conversation_id)
        except Exception as e:
            logger.warning("Qdrant retrieval failed (%s); using full PDF text", e)
            context = ""

        if not context:
            context = text[:MAX_CONTEXT_CHARS]

        llm = get_model("pdf_rag")
        steps.append({"step": "generating_response", "ts": time.time()})
        messages = [
            SystemMessage(content=PDF_RAG_SYSTEM),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion:\n{state['prompt']}"),
        ]
        response = await llm.ainvoke(messages)
        await deduct_credits(state["user_id"], "pdf")

        return {**state, "ai_response": response.content, "steps": steps}

    except Exception as e:
        logger.error("pdf_rag_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to analyze PDF.")), "steps": state.get("steps")}

    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass
