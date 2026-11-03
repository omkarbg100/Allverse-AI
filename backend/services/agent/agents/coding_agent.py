"""
Coding Agent — mirrors agents/coding.agent.js.

Flow:
  1. intent classifier → one of: CODE_GENERATION | CODE_REVIEW | CODE_EXPLANATION |
                                  DEBUGGING | OPTIMIZATION | CONVERSION | DOCUMENTATION
  2a. CODE_GENERATION → generate JSON {files:[{name,content}]} → return as artifact
  2b. Everything else → return Markdown explanation
"""

import logging
import time

from config.llm_models import get_model
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from utils.json_response import invoke_json
from graph.state import AgentState

logger = logging.getLogger(__name__)

INTENT_PROMPT = """You are an intent classifier.

Return ONLY one of these values.

CODE_GENERATION
CODE_REVIEW
CODE_EXPLANATION
DEBUGGING
OPTIMIZATION
CONVERSION
DOCUMENTATION

User Request:
"""

CODE_GEN_PROMPT = """You are Allverse AI Coding Agent.

Generate the requested project.

Default stack:
- HTML
- CSS
- JavaScript

Use React / Next.js / Vue ONLY if explicitly requested.

Rules:
- Responsive
- Modern UI
- CSS Variables
- Flexbox/Grid
- Smooth Scroll
- Hover Effects
- Beautiful spacing
- Single page unless user asks otherwise.

IMAGES
=========================

Always use real Unsplash images.

Never use placeholders.

Return ONLY valid JSON.

Schema:

{
  "files":[
    {
      "name":"index.html",
      "content":"..."
    },
    {
      "name":"style.css",
      "content":"..."
    },
    {
      "name":"script.js",
      "content":"..."
    }
  ]
}

Rules:
- Output must start with {
- Output must end with }
- No markdown
- No explanation
- No extra text
- No ```
- Never mention intent

User Request:
"""

CODE_FALLBACK_PROMPT = """You are Allverse AI Coding Agent.

Return Markdown only.
Provide the complete, working code in fenced code blocks.
Keep the explanation short and say how to run it.

User Request:

"""

REVIEW_PROMPT = """The user's request intent is: {intent}

Return Markdown only.

Never generate project files.

Use headings like:

# Overview

## Explanation

## Problems

## Improvements

## Best Practices

## Optimized Code (if needed)

User Request:

{prompt}
"""


async def coding_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "coding")

        intent_llm = get_model("intent")
        code_llm   = get_model("coding")

        intent_res = await intent_llm.ainvoke(INTENT_PROMPT + state["prompt"])
        intent = intent_res.content.strip()
        logger.info("coding_agent intent: %s", intent)

        if intent == "CODE_GENERATION":
            files = []
            try:
                data = await invoke_json(
                    code_llm,
                    CODE_GEN_PROMPT + state["prompt"],
                    '{"files":[{"name":"index.html","content":""}]}',
                )
                files = [
                    f for f in data.get("files", [])
                    if isinstance(f, dict) and str(f.get("content", "")).strip()
                ]
            except Exception as e:
                logger.warning("coding_agent JSON generation failed: %s", e)

            if files:
                await deduct_credits(state["user_id"], "coding")
                return {
                    **state,
                    "ai_response": "Code Generated Successfully.",
                    "artifacts": [
                        {
                            "id": int(time.time() * 1000),
                            "type": "Project",
                            "files": files,
                            "title": state["prompt"],
                        }
                    ],
                }

            res = await code_llm.ainvoke(CODE_FALLBACK_PROMPT + state["prompt"])
            await deduct_credits(state["user_id"], "coding")
            return {**state, "ai_response": res.content, "artifacts": []}

        # All other intents — Markdown explanation
        res = await code_llm.ainvoke(
            REVIEW_PROMPT.format(intent=intent, prompt=state["prompt"])
        )
        await deduct_credits(state["user_id"], "coding")

        return {**state, "ai_response": res.content, "artifacts": []}

    except Exception as e:
        logger.error("coding_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise
        return {
            **state,
            "ai_response": str(getattr(e, "detail", "Failed to generate code.")),
            "artifacts": [],
        }

