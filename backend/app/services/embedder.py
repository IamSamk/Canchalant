"""
Canchalant — Local CLIP Vector Embeddings

Unified vectorizer using sentence-transformers (clip-ViT-B-32)
with CUDA auto-detection. Produces dense 512-dimensional embeddings
for both images and text queries, normalized to unit length for
cosine similarity matching.
"""

from __future__ import annotations

import io
import logging
import os
from typing import List

# Force PyTorch backend for Hugging Face Transformers
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer

from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

# Restrict PyTorch thread pool overhead on cloud instances
try:
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
except Exception:
    pass

# ── Singleton Embedder ────────────────────────────────────────────

_model: SentenceTransformer | None = None
_device: str = "cpu"


def _get_device() -> str:
    """Determine the best available device."""
    settings = get_settings()
    requested = settings.device.lower()

    if requested == "cuda" and torch.cuda.is_available():
        logger.info("CLIP embedder using CUDA: %s", torch.cuda.get_device_name(0))
        return "cuda"
    elif requested == "cuda":
        logger.warning("CUDA requested but unavailable — falling back to CPU")

    return "cpu"


def get_model() -> SentenceTransformer:
    """Lazy-load and cache the CLIP model."""
    global _model, _device

    if _model is None:
        _device = _get_device()
        logger.info("Loading clip-ViT-B-32 on %s...", _device)
        _model = SentenceTransformer("clip-ViT-B-32", device=_device)
        dim = getattr(_model, "get_sentence_embedding_dimension", lambda: 512)() or 512
        logger.info("CLIP model loaded. Embedding dimension: %s", dim)

    return _model


def _normalize(vec: np.ndarray) -> List[float]:
    """L2-normalize a vector to unit length."""
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


def embed_image(image_bytes: bytes) -> List[float]:
    """
    Generate a normalized CLIP embedding for an image.

    Args:
        image_bytes: Raw JPEG/PNG bytes.

    Returns:
        List of floats (512 dimensions, L2-normalized).
    """
    model = get_model()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    embedding = model.encode(img, convert_to_numpy=True, show_progress_bar=False)
    return _normalize(embedding)


def embed_text(query: str) -> List[float]:
    """
    Generate a normalized CLIP embedding for a text query.

    Args:
        query: Natural language search string.

    Returns:
        List of floats (512 dimensions, L2-normalized).
    """
    model = get_model()
    embedding = model.encode(query, convert_to_numpy=True, show_progress_bar=False)
    return _normalize(embedding)


def get_embedding_dimension() -> int:
    """Return the dimensionality of embeddings produced by the model."""
    return get_model().get_sentence_embedding_dimension()


def check_health() -> dict:
    """Return embedder health status without triggering model download on health check."""
    global _model, _device
    _device = _get_device()
    if _model is None:
        return {
            "status": "ready (loads on demand)",
            "device": _device,
            "dimension": 512,
            "model": "clip-ViT-B-32",
        }
    try:
        dim = getattr(_model, "get_sentence_embedding_dimension", lambda: 512)() or 512
        return {
            "status": "healthy",
            "device": _device,
            "dimension": dim,
            "model": "clip-ViT-B-32",
        }
    except Exception as e:
        return {"status": f"error: {e}", "device": _device}
