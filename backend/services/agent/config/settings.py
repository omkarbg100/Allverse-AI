from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 8003

    # ── LiteLLM (unified gateway -> Groq) ──────────────────────
    LITELLM_URL: str = "http://litellm:4000"
    LITELLM_API_KEY: str = "sk-allverse-litellm-master-key"
    USE_LITELLM: bool = True

    # ── Groq (primary LLM provider) ─────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_CHAT_MODEL: str = "openai/gpt-oss-120b"
    GROQ_VISION_MODEL: str = "qwen/qwen3.6-27b"

    # ── Embeddings (FastEmbed, runs inside the agent container) ──
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    FASTEMBED_CACHE_PATH: str = "/app/.cache/fastembed"

    # ── Redis ───────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379"

    # ── MongoDB ─────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb+srv://user:pass@cluster.mongodb.net/allverse_ai"

    # ── Internal service URLs ────────────────────────────────────
    CHAT_SERVICE: str = "http://chat:8002"
    AUTH_SERVICE: str = "http://auth:8001"

    # ── S3 / MinIO ──────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_KEY: str = ""
    AWS_BUCKET_NAME: str = "agent-files"
    AWS_REGION: str = "us-east-1"
    MINIO_ENDPOINT: str = ""
    S3_PUBLIC_ENDPOINT: str = ""

    # ── Qdrant (Qdrant Cloud or self-hosted) ───────────────────
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str = ""

    # ── Tavily ──────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

