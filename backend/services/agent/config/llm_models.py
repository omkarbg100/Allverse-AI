"""
LLM Model Factory — LiteLLM proxy (routes to Groq).

Usage:
    llm = get_model("chat")
    response = await llm.ainvoke(messages)
"""

import logging
from langchain_openai import ChatOpenAI
from .settings import settings

logger = logging.getLogger(__name__)

# ── Model name maps ────────────────────────────────────────────────

MODEL_MAP: dict[str, str] = {
    "router":         settings.GROQ_CHAT_MODEL,
    "chat":           settings.GROQ_CHAT_MODEL,
    "search":         settings.GROQ_CHAT_MODEL,
    "intent":         settings.GROQ_CHAT_MODEL,
    "coding":         settings.GROQ_CHAT_MODEL,
    "pdf":            settings.GROQ_CHAT_MODEL,
    "ppt":            settings.GROQ_CHAT_MODEL,
    "pdf_rag":        settings.GROQ_CHAT_MODEL,
    "image_analyzer": settings.GROQ_VISION_MODEL,
    "image":          settings.GROQ_CHAT_MODEL,
}

STRUCTURED_AGENTS = {"intent", "coding", "pdf", "ppt"}


def _temperature(agent: str) -> float:
    return 0.2 if agent in STRUCTURED_AGENTS else 0.7


def get_model(agent: str):
    """Returns a LangChain chat model backed by the LiteLLM gateway."""
    model = MODEL_MAP.get(agent, settings.GROQ_CHAT_MODEL)
    logger.debug("Using LiteLLM gateway for agent=%s model=%s", agent, model)
    return ChatOpenAI(
        model=model,
        base_url=f"{settings.LITELLM_URL}/v1",
        api_key=settings.LITELLM_API_KEY or "sk-allverse-litellm-master-key",
        temperature=_temperature(agent),
        max_tokens=4096,
    )
