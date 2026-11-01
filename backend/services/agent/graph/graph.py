"""
LangGraph StateGraph — mirrors graph/graph.js.

Topology:
  START → router
  router → (conditional) → chat | search | coding | pdf | ppt |
                            vision | pdf_rag | image_analyzer
  search → chat           (search results feed into chat)
  all terminal nodes → END
"""

from langgraph.graph import StateGraph, START, END

from graph.state import AgentState
from graph.router import router_node
from agents.chat_agent import chat_agent
from agents.search_agent import search_agent
from agents.coding_agent import coding_agent
from agents.pdf_agent import pdf_agent
from agents.ppt_agent import ppt_agent
from agents.vision_agent import vision_agent
from agents.pdf_rag_agent import pdf_rag_agent
from agents.image_analyzer_agent import image_analyzer_agent


def _route(state: AgentState) -> str:
    agent = state.get("agent", "chat")
    valid = {
        "chat", "search", "coding", "pdf",
        "ppt", "vision", "pdf_rag", "image_analyzer",
    }
    return agent if agent in valid else "chat"


# ── Build graph ────────────────────────────────────────────────────
workflow = StateGraph(AgentState)

workflow.add_node("router",         router_node)
workflow.add_node("chat",           chat_agent)
workflow.add_node("search",         search_agent)
workflow.add_node("coding",         coding_agent)
workflow.add_node("pdf",            pdf_agent)
workflow.add_node("ppt",            ppt_agent)
workflow.add_node("vision",         vision_agent)
workflow.add_node("pdf_rag",        pdf_rag_agent)
workflow.add_node("image_analyzer", image_analyzer_agent)

# Entry
workflow.add_edge(START, "router")

# Conditional routing from router
workflow.add_conditional_edges(
    "router",
    _route,
    {
        "chat":           "chat",
        "search":         "search",
        "coding":         "coding",
        "pdf":            "pdf",
        "ppt":            "ppt",
        "vision":         "vision",
        "pdf_rag":        "pdf_rag",
        "image_analyzer": "image_analyzer",
    },
)

# search always feeds into chat (mirrors JS graph)
workflow.add_edge("search", "chat")

# Terminal edges
workflow.add_edge("chat",           END)
workflow.add_edge("coding",         END)
workflow.add_edge("pdf",            END)
workflow.add_edge("ppt",            END)
workflow.add_edge("vision",         END)
workflow.add_edge("pdf_rag",        END)
workflow.add_edge("image_analyzer", END)

# ── Compile ────────────────────────────────────────────────────────
graph = workflow.compile()

