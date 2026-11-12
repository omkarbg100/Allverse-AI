"""
LLM Model Factory — Groq API (primary and only provider).

Usage:
    llm = get_model("chat")
    response = await llm.ainvoke(messages)
"""

import logging
from langchain_groq import ChatGroq
from .settings import settings

logger = logging.getLogger(__name__)

# ── Model name maps ────────────────────────────────────────────────

GROQ_MODEL_MAP: dict[str, str] = {
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


def _build_groq(agent: str):
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set — cannot use Groq.")
    model = GROQ_MODEL_MAP.get(agent, settings.GROQ_CHAT_MODEL)
    return ChatGroq(
        model=model,
        api_key=settings.GROQ_API_KEY,
        temperature=_temperature(agent),
        max_tokens=4096,
    )


def get_model(agent: str):
    """Returns a LangChain chat model backed by the Groq API."""
    logger.debug("Using Groq for agent=%s model=%s", agent, GROQ_MODEL_MAP.get(agent))
    return _build_groq(agent)
