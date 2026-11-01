"""
Tavily search tool — mirrors tavily.js.
"""

from langchain_tavily import TavilySearch
from .settings import settings
import os

# Tavily reads TAVILY_API_KEY from env automatically
os.environ.setdefault("TAVILY_API_KEY", settings.TAVILY_API_KEY)

search_tool = TavilySearch(
    max_results=5,
    topic="general",
    include_images=True,
)

