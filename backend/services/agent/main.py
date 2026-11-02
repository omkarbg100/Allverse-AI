"""
Allverse AI — Python AI Service
FastAPI entry point — mirrors the old Node.js index.js

Run locally:
    uvicorn main:app --reload --port 8000

Run in Docker:
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import settings
from routes.agent_routes import router

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Startup / shutdown ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure temp upload directory exists
    temp = Path(__file__).parent / "temp"
    temp.mkdir(exist_ok=True)
    logger.info("Allverse AI Service starting on port %s", settings.PORT)
    logger.info("Ollama host: %s", settings.OLLAMA_HOST)
    logger.info("Groq fallback: %s", "enabled" if settings.GROQ_API_KEY else "disabled (no key)")
    yield
    logger.info("Allverse AI Service shutting down.")


# ── App ────────────────────────────────────────────────────────────
app = FastAPI(
    title="Allverse AI Service",
    description="Python FastAPI + LangGraph multi-agent AI service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────
app.include_router(router)          # registers POST /chat


@app.get("/")
async def root():
    return {"message": "hello from Allverse AI service (Python)"}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service", "version": "1.0.0"}


# ── Global error handler ───────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": f"agent error: {exc}"},
    )

