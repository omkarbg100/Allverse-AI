"""
Image Analyzer Agent — mirrors agents/imageAnalyzer.agent.js.

Flow:
  1. Read uploaded image file
  2. Base64-encode it
  3. Send to vision LLM (Ollama llava / Groq vision) as multimodal message
  4. Delete temp file in finally block
"""

import base64
import logging
import os

from langchain_core.messages import HumanMessage, SystemMessage

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)

IMAGE_ANALYZER_SYSTEM = """You are Allverse AI Image Analyzer.

Rules:
- Analyze only the uploaded image.
- Answer the user's question accurately.
- If text exists in the image, extract it.
- If charts or tables exist, explain them.
- If something is unclear, say so.
- Use Markdown when helpful.
- Do not hallucinate.
"""


async def image_analyzer_agent(state: AgentState) -> AgentState:
    file_path = state.get("file", {}).get("path") if state.get("file") else None
    try:
        await check_rate_limit(state["user_id"], "image")

        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()

        mime = state["file"]["mimetype"]
        llm  = get_model("image_analyzer")

        messages = [
            SystemMessage(content=IMAGE_ANALYZER_SYSTEM),
            HumanMessage(
                content=[
                    {"type": "text",      "text": state["prompt"] or "Analyze this image."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ]
            ),
        ]

        response = await llm.ainvoke(messages)
        await deduct_credits(state["user_id"], "vision")

        return {**state, "ai_response": response.content}

    except Exception as e:
        logger.error("image_analyzer_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to analyze image."))}

    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass

