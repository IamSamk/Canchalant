"""
Canchalant — Heuristic Pre-Filter & Blur Detection

OpenCV-based image analysis pipeline that runs *before* VLM inference
to reject motion-blurred, empty, or obviously posed frames early,
saving GPU cycles.
"""

from __future__ import annotations

import logging
from typing import Tuple

import cv2
import numpy as np

from backend.app.models.schemas import FilterResult

logger = logging.getLogger(__name__)

# OpenCV Haar cascades shipped with opencv-python (safely initialized)
_FACE_CASCADE = None
_EYE_CASCADE = None

try:
    if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data") and hasattr(cv2.data, "haarcascades"):
        face_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        eye_path = cv2.data.haarcascades + "haarcascade_eye.xml"
        _FACE_CASCADE = cv2.CascadeClassifier(face_path)
        _EYE_CASCADE = cv2.CascadeClassifier(eye_path)
        logger.info("OpenCV Haar cascades initialized successfully.")
    else:
        logger.warning("OpenCV CascadeClassifier or haarcascades data not available; face heuristics disabled.")
except Exception as _e:
    logger.warning("Could not initialize Haar cascades (%s); falling back to blur-only filtering.", _e)


def _decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes to a BGR OpenCV image."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes")
    return img


def _compute_blur_score(gray: np.ndarray) -> float:
    """Laplacian variance — higher = sharper."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _detect_faces_and_gaze(
    gray: np.ndarray,
) -> Tuple[int, int]:
    """
    Detect faces and estimate how many are directly looking at the camera.
    Since _FACE_CASCADE is a frontal face detector, any centered face
    is by nature facing the camera.

    Returns:
        (total_faces, faces_looking_at_camera)
    """
    if _FACE_CASCADE is None or _FACE_CASCADE.empty():
        return 0, 0

    try:
        faces = _FACE_CASCADE.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )
    except Exception as e:
        logger.debug("Face detection error: %s", e)
        return 0, 0

    if len(faces) == 0:
        return 0, 0

    frame_h, frame_w = gray.shape[:2]
    looking = 0

    for (x, y, w, h) in faces:
        roi_gray = gray[y : y + h, x : x + w]
        eyes_found = 0
        if _EYE_CASCADE and not _EYE_CASCADE.empty():
            try:
                eyes = _EYE_CASCADE.detectMultiScale(
                    roi_gray, scaleFactor=1.1, minNeighbors=3, minSize=(16, 16)
                )
                eyes_found = len(eyes)
            except Exception:
                eyes_found = 0

        # If eyes are detected, they are looking directly at camera
        if eyes_found >= 1:
            looking += 1
        else:
            # Frontal detector already implies front-facing orientation.
            # If face is centered in frame (standard webcam presence), treat as camera-facing.
            center_x = x + w / 2
            if (0.25 * frame_w) <= center_x <= (0.75 * frame_w) and w > (0.12 * frame_w):
                looking += 1

    return len(faces), looking


def _compute_candid_score(
    faces_detected: int, looking_at_camera: int
) -> float:
    """
    Heuristic candidness score [0.0, 1.0]:
    - No faces:              0.2  (empty scene, not a candid people moment)
    - Faces but none looking: 0.95 (genuine unposed candid)
    - Single face looking:   0.10 (direct camera stare / selfie pose)
    - Multiple, all looking: 0.15 (group pose)
    - Multiple, mixed:       proportional
    """
    if faces_detected == 0:
        return 0.2

    ratio_looking = looking_at_camera / faces_detected

    if ratio_looking >= 0.9:
        return 0.10
    elif ratio_looking == 0.0:
        return 0.95
    else:
        return round(max(0.1, 0.95 - (ratio_looking * 0.8)), 2)


def analyze_frame(
    image_bytes: bytes,
    blur_threshold: float = 80.0,
) -> FilterResult:
    """
    Run the full heuristic pre-filter pipeline on a raw image.

    Args:
        image_bytes: Raw JPEG/PNG bytes.
        blur_threshold: Laplacian variance threshold below which a
                        frame is considered too blurry.

    Returns:
        FilterResult with pass/fail verdict and all metrics.
    """
    try:
        img = _decode_image(image_bytes)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        blur_score = _compute_blur_score(gray)
        is_sharp = blur_score >= blur_threshold

        faces_detected, looking_at_camera = _detect_faces_and_gaze(gray)
        candid_score = _compute_candid_score(faces_detected, looking_at_camera)

        # Frame passes if it is sharp enough AND has some candid quality
        passed = is_sharp and candid_score >= 0.2

        result = FilterResult(
            is_sharp=is_sharp,
            blur_score=round(blur_score, 2),
            faces_detected=faces_detected,
            looking_at_camera=looking_at_camera,
            candid_score=candid_score,
            passed=passed,
        )

        logger.debug(
            "Filter: blur=%.1f sharp=%s faces=%d looking=%d candid=%.2f → %s",
            blur_score, is_sharp, faces_detected, looking_at_camera,
            candid_score, "PASS" if passed else "REJECT",
        )
        return result

    except Exception as e:
        logger.error("Pre-filter error: %s", e)
        return FilterResult(passed=False)
