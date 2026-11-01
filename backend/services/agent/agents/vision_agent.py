"""
Vision Agent — mirrors agents/vision.agent.js.

Flow: LLM enhances the user prompt into a detailed image prompt
      → Pollinations free image API → download → S3 → presigned URL
"""

import logging
import time
import urllib.parse

import httpx

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from utils.upload_to_s3 import upload_to_s3
from utils.get_from_s3 import get_from_s3
from graph.state import AgentState

logger = logging.getLogger(__name__)

ENHANCE_PROMPT = """You are an elite AI image prompt engineer.

Convert the user request into a highly detailed image generation prompt.

Requirements:
- Cinematic lighting
- Professional composition
- Ultra realistic
- High detail
- Beautiful color palette
- Sharp focus
- 8K quality
- Photorealistic
- Depth of field
- Professional photography
- Stunning visuals

Return only the image prompt.

User Request:
"""


async def vision_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "image")

        llm = get_model("image")
        res = await llm.ainvoke(ENHANCE_PROMPT + state["prompt"])
        enhanced_prompt = res.content.strip()

        image_url = (
            f"https://image.pollinations.ai/prompt/"
            f"{urllib.parse.quote(enhanced_prompt)}"
        )

        async with httpx.AsyncClient(timeout=90) as client:
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()

        img_bytes = img_resp.content
        filename = f"image-{int(time.time() * 1000)}.png"
        await upload_to_s3(filename, img_bytes, "image/png")
        await deduct_credits(state["user_id"], "vision")
        url = await get_from_s3(filename, expires_in=600)

        return {
            **state,
            "ai_response": (
                f"![Generated Image]({url})\n\n"
                f"[⬇ Download Image]({url})\n\n"
                f"_Link expires in 10 minutes._"
            ),
        }

    except Exception as e:
        logger.error("vision_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to generate image."))}

