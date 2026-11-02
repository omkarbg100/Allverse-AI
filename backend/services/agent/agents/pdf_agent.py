"""
PDF Agent — mirrors agents/pdf.agent.js.

Flow: LLM returns JSON structure → reportlab builds PDF → upload to S3 → presigned URL
"""

import logging
import time

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from utils.generate_pdf import generate_pdf
from utils.json_response import invoke_json
from utils.upload_to_s3 import upload_to_s3
from utils.get_from_s3 import get_from_s3
from graph.state import AgentState

logger = logging.getLogger(__name__)

PDF_JSON_PROMPT = """You are an expert document writer.

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return explanations.

Structure:

{"title":"","subtitle":"","sections":[{"heading":"","points":[]}]}

Generate 4-8 sections.

Each section should have 3-6 concise bullet points.

Topic:

"""


async def pdf_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "pdf")

        llm = get_model("pdf")
        data = await invoke_json(
            llm,
            PDF_JSON_PROMPT + state["prompt"],
            '{"title":"","subtitle":"","sections":[{"heading":"","points":[""]}]}',
        )
        if not isinstance(data.get("sections"), list):
            data["sections"] = []
        if not str(data.get("title", "")).strip():
            data["title"] = state["prompt"][:80]

        pdf_bytes = generate_pdf(data)
        filename = f"pdf-{int(time.time() * 1000)}.pdf"
        await upload_to_s3(filename, pdf_bytes, "application/pdf")
        url = await get_from_s3(filename, expires_in=600)
        await deduct_credits(state["user_id"], "pdf")

        return {
            **state,
            "ai_response": (
                f"# PDF Generated\n\n"
                f"**{data.get('title', '')}**\n\n"
                f"[⬇ Download PDF]({url})\n\n"
                f"_Link expires in 10 minutes._"
            ),
        }

    except Exception as e:
        logger.error("pdf_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to generate PDF."))}

