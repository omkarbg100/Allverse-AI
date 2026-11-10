"""
Agent Controller — mirrors controllers/agent.controller.js.

Handles the POST /chat request:
  1. Parse form fields + optional file upload
  2. Save user message to chat service
  3. Run LangGraph graph
  4. Persist messages to Redis memory + chat service
  5. Return {answer, images, artifacts}
"""

import logging
import os
import time
import uuid
from pathlib import Path

import httpx
from fastapi import Header, UploadFile

from config.memory import add_message
from config.settings import settings
from graph.graph import graph

logger = logging.getLogger(__name__)

TEMP_DIR = Path(__file__).parent.parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)


async def _save_message(conversation_id: str, role: str, content: str,
                        images: list | None = None, artifacts: list | None = None,
                        attachments: list | None = None):
    """POST to CHAT_SERVICE /save-message"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{settings.CHAT_SERVICE}/save-message",
                json={
                    "conversationId": conversation_id,
                    "role":           role,
                    "content":        content,
                    "images":         images,
                    "attachments":    attachments,
                    "artifacts":      artifacts,
                },
            )
    except Exception as e:
        logger.warning("save_message failed: %s", e)


async def handle_agent(
    prompt:          str,
    conversation_id: str,
    agent:           str,
    x_user_id:       str,
    file:            UploadFile | None = None,
) -> dict:
    """
    Core handler — called by the FastAPI route.
    Returns {"answer": str, "images": list|None, "artifacts": list|None}
    """

    trace_id = str(uuid.uuid4())
    steps: list[dict] = []

    def add_step(name: str) -> None:
        entry = {"step": name, "ts": time.time()}
        steps.append(entry)
        logger.info("trace=%s step=%s", trace_id, name)

    add_step("received_request")

    # ── 1. Persist uploaded file to disk (mirrors multer diskStorage) ──
    file_meta: dict | None = None
    if file and file.filename:
        safe_name = f"{int(__import__('time').time() * 1000)}-{file.filename}"
        file_path = TEMP_DIR / safe_name
        content   = await file.read()
        file_path.write_bytes(content)
        file_meta = {
            "path":     str(file_path),
            "mimetype": file.content_type or "application/octet-stream",
            "filename": file.filename,
            "size":     len(content),
        }

    attachments = [{
        "name": file_meta["filename"],
        "type": file_meta["mimetype"],
        "size": file_meta["size"],
    }] if file_meta else None

    # ── 2. Save user message to chat service ───────────────────────
    add_step("persisting_user_message")
    await _save_message(conversation_id, "user", prompt, attachments=attachments)

    # ── 3. Invoke LangGraph ────────────────────────────────────────
    result = await graph.ainvoke(
        {
            "prompt":          prompt,
            "conversation_id": conversation_id,
            "agent":           agent,
            "user_id":         x_user_id,
            "file":            file_meta,
            "steps":           steps,
        }
    )

    steps = list(result.get("steps") or steps)
    completed_entry = {"step": "completed", "ts": time.time()}
    steps.append(completed_entry)
    logger.info("trace=%s step=completed", trace_id)

    logger.info("graph result agent=%s ai_response_len=%s",
                result.get("agent"), len(result.get("ai_response") or ""))

    ai_response = result.get("ai_response", "")
    images      = result.get("images")
    artifacts   = result.get("artifacts")

    # ── 4. Update Redis memory ─────────────────────────────────────
    await add_message(conversation_id, "user",      prompt)
    await add_message(conversation_id, "assistant", ai_response)

    # ── 5. Save assistant message to chat service ──────────────────
    await _save_message(conversation_id, "assistant", ai_response, images, artifacts)

    return {
        "answer":    ai_response,
        "images":    images,
        "artifacts": artifacts,
        "trace_id":  trace_id,
        "steps":     steps,
    }

