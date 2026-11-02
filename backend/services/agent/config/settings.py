from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 8003

    # ── LiteLLM (unified gateway) ──────────────────────────────
    LITELLM_URL: str = "http://litellm:4000"
    LITELLM_API_KEY: str = "sk-cortex-litellm-master-key"
    USE_LITELLM: bool = True

    # ── Ollama ──────────────────────────────────────────────────
    OLLAMA_HOST: str = "http://host.docker.internal:11434"
    OLLAMA_CHAT_MODEL: str = "llama3.2:3b"
    OLLAMA_CODING_MODEL: str = "deepseek-coder-v2:16b"
    OLLAMA_VISION_MODEL: str = "llava:13b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # ── Groq (fallback) ─────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_CHAT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "llama-3.2-90b-vision-preview"

    # ── Redis ───────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379"

    # ── MongoDB ─────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://mongodb:27017/cortex_ai"

    # ── Internal service URLs ────────────────────────────────────
    CHAT_SERVICE: str = "http://chat:8002"
    AUTH_SERVICE: str = "http://auth:8001"

    # ── S3 / MinIO ──────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = "minioadmin"
    AWS_SECRET_KEY: str = "minioadmin"
    AWS_BUCKET_NAME: str = "agent-files"
    AWS_REGION: str = "us-east-1"
    MINIO_ENDPOINT: str = "http://minio:9000"

    # ── Qdrant ──────────────────────────────────────────────────
    QDRANT_URL: str = "http://qdrant:6333"

    # ── Tavily ──────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

