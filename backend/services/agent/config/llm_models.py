"""
LLM Model Factory — LiteLLM proxy primary (routes to Groq),
with direct Groq fallback.

Usage:
    llm = get_model("chat")
    response = await llm.ainvoke(messages)
"""

import logging
import httpx
from langchain_groq import ChatGroq
from .settings import settings

logger = logging.getLogger(__name__)

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    from langchain_community.chat_models import ChatOpenAI

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


def _build_litellm(agent: str):
    """LiteLLM exposes standard OpenAI-compatible completions API (proxies to Groq)."""
    model = GROQ_MODEL_MAP.get(agent, settings.GROQ_CHAT_MODEL)
    return ChatOpenAI(
        model=model,
        base_url=f"{settings.LITELLM_URL}/v1",
        api_key=settings.LITELLM_API_KEY or "sk-allverse-litellm-master-key",
        temperature=_temperature(agent),
        max_tokens=4096,
    )


def _build_groq(agent: str):
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set — cannot use Groq fallback.")
    model = GROQ_MODEL_MAP.get(agent, settings.GROQ_CHAT_MODEL)
    return ChatGroq(
        model=model,
        api_key=settings.GROQ_API_KEY,
        temperature=_temperature(agent),
        max_tokens=4096,
    )


def get_model(agent: str):
    """
    Returns a LangChain chat model:
      1. Tries LiteLLM gateway first (proxies to Groq)
      2. Falls back to direct Groq if LiteLLM is unavailable
    """
    if settings.USE_LITELLM and settings.LITELLM_URL:
        try:
            resp = httpx.get(f"{settings.LITELLM_URL}/health/readiness", timeout=2)
            if resp.status_code == 200:
                logger.debug("Using LiteLLM gateway for agent=%s", agent)
                return _build_litellm(agent)
        except Exception:
            try:
                resp = httpx.get(f"{settings.LITELLM_URL}/health", timeout=2)
                if resp.status_code == 200:
                    logger.debug("Using LiteLLM gateway for agent=%s", agent)
                    return _build_litellm(agent)
            except Exception:
                pass

    logger.warning("LiteLLM unavailable, falling back to direct Groq for agent=%s", agent)
    return _build_groq(agent)
