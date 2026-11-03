"""
PDF RAG Agent — mirrors agents/pdfRag.agent.js.

Flow:
  1. Read uploaded PDF with pypdf
  2. Pass the extracted text directly as context to the chat model
  3. Answer strictly from the uploaded document
  4. Delete the temp file in finally block

Direct context is used instead of a vector store so PDF analysis works without
requiring a separate embedding model to be installed locally.
"""

import logging
import os

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.messages import HumanMessage, SystemMessage

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 30000

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

        loader = PyPDFLoader(file_path)
        pages = loader.load()
        text = "\n\n".join(page.page_content for page in pages).strip()
        if not text:
            return {
                **state,
                "ai_response": "I couldn't extract any text from the uploaded PDF. It may be a scanned document.",
            }

        context = text[:MAX_CONTEXT_CHARS]
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
