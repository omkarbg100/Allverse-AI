"""
Get conversation messages from chat service — mirrors getMessages.js.
"""

import logging
import httpx
from config.settings import settings

logger = logging.getLogger(__name__)


async def get_messages(conversation_id: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{settings.CHAT_SERVICE}/get-messages/{conversation_id}"
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning("get_messages failed for conversation=%s: %s", conversation_id, e)
        return []

