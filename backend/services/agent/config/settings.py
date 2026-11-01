from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 8000

    # ── Ollama ──────────────────────────────────────────────────
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "llama3.2"
    OLLAMA_CODING_MODEL: str = "deepseek-coder-v2:16b"
    OLLAMA_VISION_MODEL: str = "llava:13b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # ── Groq (fallback) ─────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_CHAT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "llama-3.2-90b-vision-preview"

    # ── Redis ───────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── MongoDB ─────────────────────────────────────────────────
    MONGODB_URI: str = ""

    # ── Internal service URLs ────────────────────────────────────
    CHAT_SERVICE: str = "http://localhost:3002"
    AUTH_SERVICE: str = "http://localhost:3001"

    # ── AWS S3 ──────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_KEY: str = ""
    AWS_BUCKET_NAME: str = ""
    AWS_REGION: str = "ap-south-1"

    # ── Qdrant ──────────────────────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"

    # ── Tavily ──────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

