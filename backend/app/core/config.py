"""
Canchalant — Application Configuration

Loads all environment variables via pydantic-settings with
automatic .env file parsing and type coercion.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to project root
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _PROJECT_ROOT / ".env"

# Disable TensorFlow imports in sentence_transformers / transformers
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")


class Settings(BaseSettings):
    """Centralized configuration for the Canchalant backend."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── MongoDB Atlas ──────────────────────────────────────────────
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "canchalant"
    mongodb_collection: str = "moments"
    mongodb_vector_index_name: str = "vector_index"

    # ── Hugging Face Serverless Vision API ──────────────────────────
    hf_token: str = ""
    hf_vision_model: str = "google/paligemma-3b-pt-224"
    hf_api_base: str = "https://router.huggingface.co/hf-inference/models"

    # ── Cloudinary Media Storage ───────────────────────────────────
    cloudinary_cloud_name: str = "dgqqmrnjw"
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_folder: str = "canchalant_snaps"

    # ── LM Studio Local Runtime (Optional Fallback) ────────────────
    lmstudio_base_url: str = "http://localhost:1234/v1"
    lmstudio_api_key: str = "lm-studio"
    local_vision_model: str = "abetlen/paligemma-3b-mix-224-gguf"

    # ── Application ───────────────────────────────────────────────
    port: int = 8000
    host: str = "0.0.0.0"
    storage_dir: str = "./captured_photos"
    device: str = "cuda"

    @property
    def storage_path(self) -> Path:
        """Absolute path to the local fallback photo storage directory."""
        p = Path(self.storage_dir)
        if not p.is_absolute():
            p = _PROJECT_ROOT / p
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache()
def get_settings() -> Settings:
    """Singleton accessor for application settings."""
    return Settings()
