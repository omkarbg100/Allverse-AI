"""
PDF RAG Agent — mirrors agents/pdfRag.agent.js.

Flow:
  1. Read uploaded PDF with pypdf
  2. Split into chunks (RecursiveCharacterTextSplitter)
  3. Embed + store in Qdrant (temporary collection)
  4. Similarity search for user's question
  5. LLM answers from retrieved context
  6. Delete temp file in finally block
"""

import logging
import os
import time

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.messages import HumanMessage, SystemMessage

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from config.vector_db import build_vector_store
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)

PDF_RAG_SYSTEM = """You are Allverse AI PDF Assistant.

Rules:
- Answer ONLY from the uploaded PDF.
- Never make up information.
- If the answer is not present in the PDF, reply:
  "I couldn't find this information in the uploaded PDF."
- Use Markdown formatting.
"""


async def pdf_rag_agent(state: AgentState) -> AgentState:
    file_path = state.get("file", {}).get("path") if state.get("file") else None
    try:
        await check_rate_limit(state["user_id"], "pdf")

        # 1. Load PDF
        loader = PyPDFLoader(file_path)
        pages  = loader.load()

        # 2. Split into chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )
        docs = splitter.split_documents(pages)

        # 3. Embed + store in Qdrant
        collection_name = f"pdf-{int(time.time() * 1000)}"
        store = await build_vector_store(docs, collection_name)

        # 4. Similarity search
        relevant = await store.asimilarity_search(state["prompt"], k=5)
        context  = "\n\n".join(d.page_content for d in relevant)

        # 5. LLM answer
        llm = get_model("pdf_rag")
        messages = [
            SystemMessage(content=PDF_RAG_SYSTEM),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion:\n{state['prompt']}"),
        ]
        response = await llm.ainvoke(messages)
        await deduct_credits(state["user_id"], "pdf")

        return {**state, "ai_response": response.content}

    except Exception as e:
        logger.error("pdf_rag_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to analyze PDF."))}

    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass

