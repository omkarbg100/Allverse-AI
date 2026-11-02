"""
Chat Agent — mirrors agents/chat.agent.js.

Flow: check rate limit → get Redis memory → build messages → invoke LLM
      → deduct credits → return ai_response
"""

import logging
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from config.llm_models import get_model
from config.memory import get_memory
from config.rate_limit import check_rate_limit
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)


async def chat_agent(state: AgentState) -> AgentState:
    try:
        await check_rate_limit(state["user_id"], "chat")

        llm = get_model("chat")
        history = await get_memory(state["conversation_id"])

        # Build search context block (when search agent ran before us)
        search_results = state.get("search_results")
        if search_results:
            import json
            search_context = (
                f"\n   Web Search Results:\n\n"
                f"{json.dumps(search_results)}\n\n"
                f"Answer the user using only the above search results.\n"
            )
        else:
            search_context = ""

        system_prompt = f"""You are Allverse AI, an intelligent AI assistant.

{search_context}

{"If searchContext exists:" if search_context else ""}
{"- Use search results to answer." if search_context else ""}
{"- Do not mention internal tools." if search_context else ""}

Rules:
- For simple questions, greetings, and short queries, respond naturally in plain text.
- For technical, educational, coding, or detailed topics, use clean Markdown.

Formatting:
- Use # for titles and ## for sections.
- Leave a blank line after headings.
- Use bullet points for lists.
- Use numbered lists for steps.
- Use fenced code blocks with language tags for code.
- Keep paragraphs short and readable.
- Never write headings and content on the same line.
- Never generate large walls of text.
"""

        messages: list = [SystemMessage(content=system_prompt)]

        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=state["prompt"]))

        response = await llm.ainvoke(messages)
        await deduct_credits(state["user_id"], "chat")

        return {**state, "ai_response": response.content}

    except Exception as e:
        logger.error("chat_agent error: %s", e, exc_info=True)
        error_msg = getattr(e, "detail", None)
        if isinstance(error_msg, dict):
            raise  # re-raise HTTPException (rate limit)
        return {**state, "ai_response": str(getattr(e, "detail", "Failed to generate chat response."))}

