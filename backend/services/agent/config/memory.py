"""
Redis-backed conversation memory.

Mirrors the JS memory.js:
  - getMemory()   → fetch from Redis cache, fallback to chat service
  - addMessage()  → append to Redis cache (sliding 20-msg window)
"""

import json
import logging
import httpx
import redis.asyncio as aioredis
from .settings import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def get_memory(conversation_id: str) -> list[dict]:
    """Return conversation history list [{role, content}, ...]"""
    r = get_redis()
    key = f"messages-{conversation_id}"

    cached = await r.get(key)
    if cached:
        return json.loads(cached)

    # Fallback: fetch from chat service
    messages = await _fetch_from_chat_service(conversation_id)
    if messages:
        await r.set(key, json.dumps(messages), ex=86400)  # 24h TTL
    return messages or []


async def add_message(conversation_id: str, role: str, content: str) -> None:
    """Append a message to the Redis cache (max 20 messages, sliding window)."""
    r = get_redis()
    key = f"messages-{conversation_id}"

    raw = await r.get(key)
    messages: list[dict] = json.loads(raw) if raw else []
    messages.append({"role": role, "content": content})

    if len(messages) > 20:
        messages = messages[-20:]  # keep last 20

    await r.set(key, json.dumps(messages))


async def _fetch_from_chat_service(conversation_id: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.CHAT_SERVICE}/get-messages/{conversation_id}"
            )
            resp.raise_for_status()
            raw: list[dict] = resp.json()
            # Normalise to [{role, content}]
            return [{"role": m["role"], "content": m["content"]} for m in raw]
    except Exception as e:
        logger.warning("Could not fetch messages from chat service: %s", e)
        return []

