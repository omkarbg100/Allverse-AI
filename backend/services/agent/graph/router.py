"""
Router Node — mirrors graph/router.js.

Priority:
  1. agent field explicitly set (not "auto") → use it directly
  2. File upload detected → route by MIME type
  3. LLM classifies the user's text prompt → returns agent name
"""

import logging
from config.llm_models import get_model
from graph.state import AgentState

logger = logging.getLogger(__name__)

ROUTER_PROMPT = """You are an agent router.

Available agents:

- chat
- search
- coding
- pdf
- ppt
- vision

Rules:

chat:
General conversation,
explanations,
learning,
questions.

search:
Current events,
latest information,
news,
recent developments,
internet lookup.

coding:
Generate code,
debug code,
build projects,
architecture,
API design.

pdf:
Questions about generating PDFs
or document context.

ppt:
Questions about generating PPTs
or presentation context.

vision:
Generate image,
create image.

Return ONLY one word:

chat
search
coding
pdf
ppt
vision

User Query:
"""


async def router_node(state: AgentState) -> AgentState:
    # 1. Explicitly chosen agent (not auto)
    if state.get("agent") and state["agent"] != "auto":
        return state

    # 2. Auto-detect from uploaded file MIME type
    if state.get("file"):
        mime = state["file"].get("mimetype", "")
        if mime == "application/pdf":
            return {**state, "agent": "pdf_rag"}
        if mime.startswith("image/"):
            return {**state, "agent": "image_analyzer"}

    # 3. LLM-based intent classification
    llm = get_model("router")
    response = await llm.ainvoke(ROUTER_PROMPT + state["prompt"])
    agent = response.content.strip().lower()

    # Guard: only allow known agents
    valid = {"chat", "search", "coding", "pdf", "ppt", "vision"}
    if agent not in valid:
        agent = "chat"

    logger.info("router_node → %s", agent)
    return {**state, "agent": agent}

