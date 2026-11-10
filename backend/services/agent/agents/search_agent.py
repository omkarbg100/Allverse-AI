"""Search Agent — mirrors agents/search.agent.js."""
import logging
import time
from config.rate_limit import check_rate_limit
from config.tavily_tool import search_tool
from utils.deduct_credits import deduct_credits
from graph.state import AgentState

logger = logging.getLogger(__name__)

async def search_agent(state: AgentState) -> AgentState:
    """Run Tavily search, store results, and deduct credits."""
    try:
        await check_rate_limit(state["user_id"], "search")
        steps = list(state.get("steps") or [])
        steps.append({"step": "searching_web", "ts": time.time()})
        results = await search_tool.ainvoke({"query": state["prompt"]})
        await deduct_credits(state["user_id"], "search")
        logger.info("search_agent results: %s", results)
        return {
            **state,
            "search_results": results,
            "images": results.get("images", []) if isinstance(results, dict) else [],
            "steps": steps,
        }
    except Exception as e:  # pragma: no cover
        logger.error("search_agent error: %s", e, exc_info=True)
        return {
            **state,
            "search_results": [],
            "images": [],
            "ai_response": str(getattr(e, "detail", "Failed to search.")),
            "steps": state.get("steps"),
        }
