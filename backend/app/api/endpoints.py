"""
Canchalant — REST API Endpoints

Full analysis pipeline, Cloudinary media storage, gallery browsing,
semantic vector search, deletion, and health monitoring.
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status

from backend.app.core.config import get_settings
from backend.app.models.schemas import (
    CaptureMode,
    Classification,
    FrameAnalyzeRequest,
    FrameAnalyzeResponse,
    HealthResponse,
    MomentDocument,
    SemanticSearchRequest,
    VLMResult,
)
from backend.app.services import db, embedder, storage, vlm
from backend.app.services.filter import analyze_frame

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["canchalant"])


# ── POST /api/frame/analyze ───────────────────────────────────────

@router.post("/frame/analyze", response_model=FrameAnalyzeResponse)
async def analyze_frame_endpoint(request: FrameAnalyzeRequest):
    """
    End-to-End Analysis Pipeline:
    1. Decode base64 camera frame.
    2. Run heuristic pre-filter (Laplacian blur & gaze check).
    3. Run open-weight Gemma Vision (PaliGemma) via HF Serverless API.
    4. Generate 512-dim CLIP dense vector embedding.
    5. Upload candidate capture to Cloudinary folder `canchalant_snaps`.
    6. Persist moment document with HTTPS Cloudinary URL in MongoDB Atlas.
    """
    # Step 1: Decode image
    try:
        image_bytes = base64.b64decode(request.image_base64)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {e}",
        )

    # Step 2: Heuristic pre-filter
    filter_result = analyze_frame(image_bytes, blur_threshold=request.blur_threshold)

    if not filter_result.is_sharp:
        return FrameAnalyzeResponse(
            status="rejected_blur",
            filter_result=filter_result,
            message=f"Frame too blurry (blur score: {filter_result.blur_score:.1f}, cutoff: {request.blur_threshold})",
        )

    if request.mode in (CaptureMode.PASSIVE, CaptureMode.BURST):
        if not filter_result.passed:
            return FrameAnalyzeResponse(
                status="rejected_posed",
                filter_result=filter_result,
                message=f"Frame appears posed or camera-facing (candid score: {filter_result.candid_score:.2f})",
            )

    # Step 3: Gemma Vision classification
    vlm_result = await vlm.analyze_image(image_bytes)

    # Confidence check
    if vlm_result.confidence < request.confidence_threshold:
        return FrameAnalyzeResponse(
            status="rejected_confidence",
            filter_result=filter_result,
            vlm_result=vlm_result,
            message=f"Below confidence threshold ({vlm_result.confidence:.2f} < {request.confidence_threshold})",
        )

    if request.mode == CaptureMode.PASSIVE:
        if vlm_result.classification in (Classification.POSED, Classification.JUNK):
            return FrameAnalyzeResponse(
                status="rejected_posed",
                filter_result=filter_result,
                vlm_result=vlm_result,
                message=f"Vision model classified as {vlm_result.classification.value}",
            )

    # Step 4: Generate CLIP vector embedding
    embedding = embedder.embed_image(image_bytes)

    # Step 5: Upload to Cloudinary
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"candid_{timestamp}_{uuid4().hex[:6]}.jpg"

    upload_result = storage.upload_image(image_bytes, filename)
    cloudinary_url = upload_result.get("secure_url", "")
    cloudinary_public_id = upload_result.get("public_id")

    # Step 6: Persist in MongoDB Atlas
    moment = MomentDocument(
        filename=filename,
        cloudinary_url=cloudinary_url,
        cloudinary_public_id=cloudinary_public_id,
        filepath=cloudinary_url,  # Web-accessible HTTPS URL
        classification=vlm_result.classification,
        confidence=vlm_result.confidence,
        caption=vlm_result.caption,
        tags=vlm_result.mood_tags,
        embedding=embedding,
        filter_meta=filter_result,
    )

    await db.save_moment(moment)

    logger.info(
        "✨ Moment Captured: %s [%s @ %.2f] — URL: %s",
        filename,
        vlm_result.classification.value,
        vlm_result.confidence,
        cloudinary_url,
    )

    return FrameAnalyzeResponse(
        status="captured",
        filter_result=filter_result,
        vlm_result=vlm_result,
        moment=moment,
        message="Authentic candid moment saved to Cloudinary & MongoDB Atlas!",
    )


# ── GET /api/gallery ──────────────────────────────────────────────

@router.get("/gallery")
async def get_gallery(
    page: int = 1,
    limit: int = 20,
    classification: str | None = None,
    tag: str | None = None,
):
    """Paginated moments gallery with optional classification and mood tag filters."""
    cls_filter = None
    if classification:
        try:
            cls_filter = Classification(classification)
        except ValueError:
            raise HTTPException(400, f"Invalid classification: {classification}")

    moments = await db.get_moments(
        page=page, limit=limit,
        classification=cls_filter, tag=tag,
    )
    total = await db.get_total_count(classification=cls_filter, tag=tag)

    return {
        "moments": moments,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": (total + limit - 1) // limit if limit > 0 else 0,
    }


# ── POST /api/gallery/search ─────────────────────────────────────

@router.post("/gallery/search")
async def semantic_search(request: SemanticSearchRequest):
    """
    Semantic vector search using MongoDB Atlas `$vectorSearch`:
    Converts query text to 512-dim CLIP embedding and returns
    cosine-ranked moments.
    """
    if not request.query.strip():
        raise HTTPException(400, "Search query cannot be empty.")

    query_vector = embedder.embed_text(request.query)
    results = await db.search_moments(query_vector, limit=request.limit)

    return {
        "query": request.query,
        "results": results,
        "count": len(results),
    }


# ── DELETE /api/gallery/{id} ──────────────────────────────────────

@router.delete("/gallery/{moment_id}")
async def delete_moment(moment_id: str):
    """Delete moment from MongoDB Atlas and Cloudinary media storage."""
    deleted = await db.delete_moment(moment_id)
    if not deleted:
        raise HTTPException(404, f"Moment not found: {moment_id}")
    return {"status": "deleted", "id": moment_id}


# ── GET /api/health ───────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """System health check across all integrated services."""
    mongo_status = await db.check_health()
    hf_status = await vlm.check_health()
    cloud_status = storage.check_health()
    embed_info = embedder.check_health()

    return HealthResponse(
        status="ok",
        mongodb=mongo_status,
        huggingface=hf_status,
        cloudinary=cloud_status,
        embedder=embed_info.get("status", "unknown"),
        device=embed_info.get("device", "unknown"),
    )
