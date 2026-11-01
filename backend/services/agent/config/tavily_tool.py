"""
Tavily search tool — mirrors tavily.js.
Uses official tavily-python client without langchain version locking.
"""

import logging
from tavily import AsyncTavilyClient
from .settings import settings

logger = logging.getLogger(__name__)


class TavilySearchTool:
    def __init__(self):
        self.api_key = settings.TAVILY_API_KEY

    async def ainvoke(self, input_dict: dict) -> dict:
        query = input_dict.get("query", "")
        if not settings.TAVILY_API_KEY:
            logger.warning("Tavily search requested but TAVILY_API_KEY is not set.")
            return {
                "results": [],
                "images": [],
                "query": query,
            }
        try:
            client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
            res = await client.search(
                query=query,
                max_results=5,
                include_images=True,
                topic="general",
            )
            return res
        except Exception as e:
            logger.error("Tavily search error: %s", e)
            return {
                "results": [],
                "images": [],
                "error": str(e),
                "query": query,
            }


search_tool = TavilySearchTool()
