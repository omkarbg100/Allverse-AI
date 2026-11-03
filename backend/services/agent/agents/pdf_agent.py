"""
PDF Agent — mirrors agents/pdf.agent.js.

Flow: LLM returns JSON structure → reportlab builds PDF → upload to S3 → presigned URL
"""

import logging
import time

from langchain_community.document_loaders import PyPDFLoader

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

User request:

"""


def _read_source_document(file: dict | None) -> str:
    if not file or file.get("mimetype") != "application/pdf":
        return ""
    try:
        pages = PyPDFLoader(file["path"]).load()
        text = "\n\n".join(page.page_content for page in pages).strip()
        return text[:14000]
    except Exception as e:
        logger.warning("pdf_agent could not read source PDF: %s", e)
        return ""


async def pdf_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "pdf")

        source = _read_source_document(state.get("file"))
        user_request = state["prompt"]
        if source:
            logger.info("pdf_agent using uploaded source (%s chars)", len(source))
            user_request += (
                "\n\nRewrite and update the source document below according to the "
                "request above. Keep important factual details, improve the structure "
                "and wording, and return the result as the document described in the "
                "JSON schema.\n\nSOURCE DOCUMENT:\n" + source
            )

        llm = get_model("pdf")
        data = await invoke_json(
            llm,
            PDF_JSON_PROMPT + user_request,
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
