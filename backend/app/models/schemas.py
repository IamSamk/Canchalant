"""
Canchalant — Pydantic Schemas

Request / response models and internal data transfer objects
for the analysis pipeline, Cloudinary media storage, and REST API.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ── Enumerations ──────────────────────────────────────────────────

class Classification(str, Enum):
    SPECIFIC_CANDID = "SPECIFIC_CANDID"
    GENERAL_CANDID = "GENERAL_CANDID"
    POSED = "POSED"
    JUNK = "JUNK"


class CaptureMode(str, Enum):
    PASSIVE = "passive"       # Hands-free auto-snap
    MANUAL = "manual"         # Manual capture + auto-tag
    BURST = "burst"           # Burst candid hunt


# ── VLM Analysis Result ──────────────────────────────────────────

class VLMResult(BaseModel):
    """Structured output from the Gemma vision model."""
    classification: Classification = Classification.JUNK
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    caption: str = "Unable to analyze this frame."
    mood_tags: List[str] = Field(default_factory=list)


# ── Pre-Filter Result ────────────────────────────────────────────

class FilterResult(BaseModel):
    """Output of the heuristic pre-filter pipeline."""
    is_sharp: bool = False
    blur_score: float = 0.0
    faces_detected: int = 0
    looking_at_camera: int = 0
    candid_score: float = 0.0
    passed: bool = False


# ── Moment Document (MongoDB Atlas & Storage) ────────────────────

class MomentDocument(BaseModel):
    """Schema for a captured moment stored in MongoDB Atlas."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    filename: str
    cloudinary_url: str = ""
    cloudinary_public_id: Optional[str] = None
    filepath: str = ""  # fallback or local reference
    classification: Classification
    confidence: float = Field(ge=0.0, le=1.0)
    caption: str
    tags: List[str] = Field(default_factory=list)
    embedding: List[float] = Field(default_factory=list)
    filter_meta: Optional[FilterResult] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ── API Request / Response Models ─────────────────────────────────

class FrameAnalyzeRequest(BaseModel):
    """Request body for POST /api/frame/analyze."""
    image_base64: str
    mode: CaptureMode = CaptureMode.PASSIVE
    confidence_threshold: float = Field(default=0.65, ge=0.0, le=1.0)
    blur_threshold: float = Field(default=80.0, ge=0.0)


class FrameAnalyzeResponse(BaseModel):
    """Response from the frame analysis pipeline."""
    status: str  # "captured", "rejected_blur", "rejected_posed", "rejected_confidence", "error"
    filter_result: Optional[FilterResult] = None
    vlm_result: Optional[VLMResult] = None
    moment: Optional[MomentDocument] = None
    message: str = ""


class SemanticSearchRequest(BaseModel):
    """Request body for POST /api/gallery/search."""
    query: str
    limit: int = Field(default=20, ge=1, le=50)


class SemanticSearchResult(BaseModel):
    """A single search result with vector similarity score."""
    id: str
    filename: str
    cloudinary_url: str = ""
    filepath: str = ""
    classification: Classification
    confidence: float
    caption: str
    tags: List[str]
    score: float
    created_at: str


class HealthResponse(BaseModel):
    """Response for GET /api/health."""
    status: str = "ok"
    mongodb: str = "unknown"
    huggingface: str = "unknown"
    cloudinary: str = "unknown"
    embedder: str = "unknown"
    device: str = "unknown"
