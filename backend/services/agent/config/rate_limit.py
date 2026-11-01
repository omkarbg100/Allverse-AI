"""
Redis-based per-agent rate limiting.
Mirrors agentLimit.js — 60-second sliding window counters.
"""

import logging
import redis.asyncio as aioredis
from fastapi import HTTPException
from .settings import settings
from .memory import get_redis

logger = logging.getLogger(__name__)

LIMITS: dict[str, int] = {
    "chat":   20,
    "coding":  5,
    "pdf":     5,
    "ppt":     5,
    "image":   5,
    "search":  5,
}


async def check_rate_limit(user_id: str, agent: str) -> dict:
    """
    Increment the rate-limit counter for (user, agent).
    Raises HTTP 429 if limit exceeded.
    Returns {"remaining": int, "limit": int} on success.
    """
    r = get_redis()
    max_req = LIMITS.get(agent, LIMITS["chat"])
    key = f"rate:{user_id}:{agent}"

    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 60)  # 60-second window

    if count > max_req:
        ttl = await r.ttl(key)
        minutes = ttl // 60
        seconds = ttl % 60
        time_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"

        raise HTTPException(
            status_code=429,
            detail={
                "success": False,
                "agent": agent,
                "limit": max_req,
                "remainingTime": ttl,
                "retryAfter": time_str,
                "message": (
                    f"You have reached the {agent} limit "
                    f"({max_req} requests/minute). Try again in {time_str}."
                ),
            },
        )

    return {"remaining": max_req - count, "limit": max_req}

