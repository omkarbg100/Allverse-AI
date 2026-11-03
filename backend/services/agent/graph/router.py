"""
Router Node — mirrors graph/router.js.

Priority:
  1. agent field explicitly set (not "auto") → use it directly
  2. File upload detected → route by MIME type
  3. Deterministic keyword rules → route to a specialist agent
  4. No strong signal → chat

Routing is keyword-based because small local models are unreliable at returning
single-word labels and tend to over-route ordinary questions to PDF/PPT.
"""

import logging
import re

from graph.state import AgentState

logger = logging.getLogger(__name__)

PDF_REWRITE_PATTERN = re.compile(
    r"\b(?:rewrite|revise|update|edit|improve|tailor|generate|create|make|draft|prepare|format)\b"
)

ROUTE_RULES: list[tuple[str, tuple[re.Pattern, ...]]] = [
    (
        "pdf",
        (
            re.compile(r"\bpdfs?\b"),
            re.compile(
                r"\b(?:create|generate|make|write|draft|prepare)\b"
                r"[^\n]{0,80}\b(?:document|report)\b"
            ),
            re.compile(r"\bdownloadable\b"),
        ),
    ),
    (
        "ppt",
        (
            re.compile(r"\b(?:ppt|pptx?|powerpoint)\b"),
            re.compile(r"\bpresentations?\b"),
            re.compile(r"\bslides?\b"),
            re.compile(r"\bdeck\b"),
        ),
    ),
    (
        "vision",
        (
            re.compile(r"\b(?:draw|sketch|illustrate)\b"),
            re.compile(
                r"\b(?:create|generate|make|design)\b"
                r"[^\n]{0,60}\b(?:image|picture|illustration|logo|poster|artwork)\b"
            ),
            re.compile(r"\b(?:image|logo|poster) generation\b"),
        ),
    ),
    (
        "search",
        (
            re.compile(r"\b(?:latest|newest|news|current events?|today|recent|breaking)\b"),
            re.compile(
                r"\b(?:search (?:the )?(?:web|internet)|web search|"
                r"look (?:it|this|that)? ?up|google)\b"
            ),
            re.compile(r"\bweather\b"),
        ),
    ),
    (
        "coding",
        (
            re.compile(r"\b(?:debug|compile|syntax error|stack trace)\b"),
            re.compile(
                r"\b(?:write|generate|create|build|fix|debug|refactor|optimize|review)\b"
                r"[^\n]{0,60}\b(?:code|function|component|script|program|app|"
                r"website|api|architecture|database schema)\b"
            ),
            re.compile(r"\b(?:html|css|javascript|typescript|python|react|node\.?js|sql)\b"),
        ),
    ),
]


def classify_prompt(prompt: str) -> str:
    text = prompt.lower().strip()
    for agent, patterns in ROUTE_RULES:
        if any(pattern.search(text) for pattern in patterns):
            return agent
    return "chat"


async def router_node(state: AgentState) -> AgentState:
    # 1. Explicitly chosen agent (not auto)
    if state.get("agent") and state["agent"] != "auto":
        return state

    # 2. Auto-detect from uploaded file MIME type
    if state.get("file"):
        mime = state["file"].get("mimetype", "")
        if mime == "application/pdf":
            if PDF_REWRITE_PATTERN.search(state["prompt"].lower()):
                return {**state, "agent": "pdf"}
            return {**state, "agent": "pdf_rag"}
        if mime.startswith("image/"):
            return {**state, "agent": "image_analyzer"}

    # 3. Deterministic keyword classification
    agent = classify_prompt(state["prompt"])

    logger.info("router_node → %s", agent)
    return {**state, "agent": agent}
