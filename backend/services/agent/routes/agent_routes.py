"""
Agent routes — mirrors routes/agent.route.js.

Exposes:
  POST /chat   multipart/form-data
    fields: prompt, conversationId, agent (optional)
    file:   file (optional — PDF or image, max 20 MB)
"""

from fastapi import APIRouter, Form, File, Header, UploadFile
from typing import Optional

from controllers.agent_controller import handle_agent

router = APIRouter()


@router.post("/chat")
async def chat_endpoint(
    prompt:          str           = Form(...),
    conversationId:  str           = Form(...),
    agent:           str           = Form(default="auto"),
    file:            Optional[UploadFile] = File(default=None),
    x_user_id:       str           = Header(..., alias="x-user-id"),
):
    """
    Main agent invocation endpoint.
    Accepts multipart form data matching the original JS /chat route.
    """
    result = await handle_agent(
        prompt=prompt,
        conversation_id=conversationId,
        agent=agent,
        x_user_id=x_user_id,
        file=file,
    )
    return result

