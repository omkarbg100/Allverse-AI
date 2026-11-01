"""
Deduct credits — mirrors deductCredits.js.
POSTs to AUTH_SERVICE /deduct-credits with userId + agent.
"""

import logging
import httpx
from config.settings import settings

logger = logging.getLogger(__name__)


async def deduct_credits(user_id: str, agent: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE}/deduct-credits",
                json={"userId": user_id, "agent": agent},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning("deduct_credits failed for user=%s agent=%s: %s", user_id, agent, e)
        return None

