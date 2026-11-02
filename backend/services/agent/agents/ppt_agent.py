"""
PPT Agent — mirrors agents/ppt.agent.js.

Flow: LLM returns JSON (title + 6 slides) → python-pptx builds PPTX → S3 → URL
"""

import logging
import time

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from utils.generate_ppt import generate_ppt
from utils.json_response import invoke_json
from utils.upload_to_s3 import upload_to_s3
from utils.get_from_s3 import get_from_s3
from graph.state import AgentState

logger = logging.getLogger(__name__)

PPT_JSON_PROMPT = """You are a professional presentation designer.

Return ONLY valid JSON.

Format:

{"title":"","subtitle":"","slides":[{"title":"","points":["","","",""]}]}

Rules:
- Generate exactly 6 content slides.
- Each slide should have 4-6 concise bullet points.
- No markdown.
- No explanation.
- No code block.
- Return ONLY JSON.

Topic:

"""


async def ppt_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "ppt")

        llm = get_model("ppt")
        data = await invoke_json(
            llm,
            PPT_JSON_PROMPT + state["prompt"],
            '{"title":"","subtitle":"","slides":[{"title":"","points":[""]}]}',
        )
        if not isinstance(data.get("slides"), list):
            data["slides"] = []
        if not str(data.get("title", "")).strip():
            data["title"] = state["prompt"][:80]

        ppt_bytes = generate_ppt(data)
        filename  = f"ppt-{int(time.time() * 1000)}.pptx"
        content_type = (
            "application/vnd.openxmlformats-officedocument"
            ".presentationml.presentation"
        )
        await upload_to_s3(filename, ppt_bytes, content_type)
        url = await get_from_s3(filename, expires_in=600)
        await deduct_credits(state["user_id"], "ppt")

        return {
            **state,
            "ai_response": (
                f"# Presentation Generated\n\n"
                f"**{data.get('title', '')}**\n\n"
                f"[⬇ Download PPT]({url})\n\n"
                f"_Link expires in 10 minutes._"
            ),
        }

    except Exception as e:
        logger.error("ppt_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to generate presentation."))}

