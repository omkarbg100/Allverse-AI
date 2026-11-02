"""
LLM Model Factory — LiteLLM proxy primary (unified gateway to local Ollama & Groq),
with direct Ollama and Groq fallbacks.

Usage:
    llm = get_model("chat")
    response = await llm.ainvoke(messages)
"""

import logging
import httpx
from langchain_ollama import ChatOllama
from langchain_groq import ChatGroq
from .settings import settings

logger = logging.getLogger(__name__)

# ── Model name maps ────────────────────────────────────────────────

OLLAMA_MODEL_MAP: dict[str, str] = {
    "router":         settings.OLLAMA_CHAT_MODEL,
    "chat":           settings.OLLAMA_CHAT_MODEL,
    "search":         settings.OLLAMA_CHAT_MODEL,
    "intent":         settings.OLLAMA_CHAT_MODEL,
    "coding":         settings.OLLAMA_CODING_MODEL,
    "pdf":            settings.OLLAMA_CHAT_MODEL,
    "ppt":            settings.OLLAMA_CHAT_MODEL,
    "pdf_rag":        settings.OLLAMA_CHAT_MODEL,
    "image_analyzer": settings.OLLAMA_VISION_MODEL,
    "image":          settings.OLLAMA_CHAT_MODEL,
}

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


def _build_litellm(agent: str):
    """LiteLLM exposes standard OpenAI-compatible completions API."""
    model = OLLAMA_MODEL_MAP.get(agent, settings.OLLAMA_CHAT_MODEL)
    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        from langchain_community.chat_models import ChatOpenAI

    return ChatOpenAI(
        model=model,
        base_url=f"{settings.LITELLM_URL}/v1",
        api_key=settings.LITELLM_API_KEY or "sk-allverse-litellm-master-key",
        temperature=0.7,
        max_tokens=4096,
    )


def _build_ollama(agent: str):
    model = OLLAMA_MODEL_MAP.get(agent, settings.OLLAMA_CHAT_MODEL)
    return ChatOllama(
        model=model,
        base_url=settings.OLLAMA_HOST,
        temperature=0.7,
        num_predict=4096,
    )


def _build_groq(agent: str):
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set — cannot use Groq fallback.")
    model = GROQ_MODEL_MAP.get(agent, settings.GROQ_CHAT_MODEL)
    return ChatGroq(
        model=model,
        api_key=settings.GROQ_API_KEY,
        temperature=0.7,
        max_tokens=4096,
    )


def get_model(agent: str):
    """
    Returns a LangChain chat model:
      1. Tries LiteLLM unified gateway first (routes to Ollama / Groq / custom providers)
      2. Falls back to direct Ollama on host
      3. Falls back to Groq if Ollama is unavailable
    """
    # 1. Try LiteLLM gateway if configured
    if settings.USE_LITELLM and settings.LITELLM_URL:
        try:
            resp = httpx.get(f"{settings.LITELLM_URL}/health/readiness", timeout=2)
            if resp.status_code == 200:
                logger.debug("Using LiteLLM gateway for agent=%s", agent)
                return _build_litellm(agent)
        except Exception:
            try:
                # Some versions respond at /health
                resp = httpx.get(f"{settings.LITELLM_URL}/health", timeout=2)
                if resp.status_code == 200:
                    logger.debug("Using LiteLLM gateway for agent=%s", agent)
                    return _build_litellm(agent)
            except Exception:
                pass

    # 2. Try direct Ollama
    try:
        llm = _build_ollama(agent)
        resp = httpx.get(f"{settings.OLLAMA_HOST}/api/tags", timeout=3)
        resp.raise_for_status()
        logger.debug("Using direct Ollama for agent=%s model=%s", agent, OLLAMA_MODEL_MAP.get(agent))
        return llm
    except Exception as e:
        logger.warning("Ollama unavailable (%s), falling back to Groq for agent=%s", e, agent)
        return _build_groq(agent)
