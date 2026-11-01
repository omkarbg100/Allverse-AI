"""
LangGraph agent state — mirrors graph/state.js (Annotation.Root).
"""

from typing import TypedDict, Optional, Any


class AgentState(TypedDict, total=False):
    prompt:          str
    ai_response:     Optional[str]
    agent:           Optional[str]        # "auto" | "chat" | "search" | ...
    conversation_id: str
    search_results:  Optional[Any]
    images:          Optional[list[str]]
    artifacts:       Optional[list[Any]]
    user_id:         str
    file:            Optional[dict]       # {path, mimetype, filename}

