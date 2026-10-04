"""
Canchalant — Application Configuration

Loads all environment variables via pydantic-settings with
automatic .env file parsing and type coercion.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
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
        env_file=str(_ENV_FILE) if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── MongoDB Atlas ──────────────────────────────────────────────
    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        validation_alias=AliasChoices("mongodb_uri", "mongodb_atlas_uri", "MONGODB_URI", "MONGODB_ATLAS_URI"),
    )
    mongodb_db_name: str = Field(
        default="canchalant",
        validation_alias=AliasChoices("mongodb_db_name", "MONGODB_DB_NAME"),
    )
    mongodb_collection: str = Field(
        default="moments",
        validation_alias=AliasChoices("mongodb_collection", "mongodb_collection_name", "MONGODB_COLLECTION", "MONGODB_COLLECTION_NAME"),
    )
    mongodb_vector_index_name: str = Field(
        default="vector_index",
        validation_alias=AliasChoices("mongodb_vector_index_name", "MONGODB_VECTOR_INDEX_NAME"),
    )

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
    def clean_mongodb_uri(self) -> str:
        """Sanitize URI by stripping surrounding quotes and whitespace."""
        return self.mongodb_uri.strip("\"' \t\r\n")

    @property
    def clean_hf_token(self) -> str:
        """Sanitize HF token."""
        return self.hf_token.strip("\"' \t\r\n")

    @property
    def clean_cloudinary_api_key(self) -> str:
        """Sanitize Cloudinary API key."""
        return self.cloudinary_api_key.strip("\"' \t\r\n")

    @property
    def clean_cloudinary_api_secret(self) -> str:
        """Sanitize Cloudinary API secret."""
        return self.cloudinary_api_secret.strip("\"' \t\r\n")

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
