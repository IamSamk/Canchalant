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

# OpenCV Haar cascades shipped with opencv-python
_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
_EYE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_eye.xml"
)


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
    Detect faces and estimate how many are directly looking at the camera
    (eyes visible within each face region).

    Returns:
        (total_faces, faces_looking_at_camera)
    """
    faces = _FACE_CASCADE.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )

    if len(faces) == 0:
        return 0, 0

    looking = 0
    for (x, y, w, h) in faces:
        roi_gray = gray[y : y + h, x : x + w]
        eyes = _EYE_CASCADE.detectMultiScale(
            roi_gray, scaleFactor=1.1, minNeighbors=4, minSize=(20, 20)
        )
        # If both eyes are clearly detected, the person is likely
        # facing the camera directly (potential posed shot)
        if len(eyes) >= 2:
            looking += 1

    return len(faces), looking


def _compute_candid_score(
    faces_detected: int, looking_at_camera: int
) -> float:
    """
    Heuristic candidness score [0.0, 1.0]:
    - No faces:              0.3  (ambient shot, could be scenery)
    - Faces but none looking: 1.0  (genuine candid)
    - Some looking:          scaled down proportionally
    - All looking:           0.1  (likely posed)
    """
    if faces_detected == 0:
        return 0.3

    ratio_looking = looking_at_camera / faces_detected

    if ratio_looking == 0.0:
        return 1.0
    elif ratio_looking >= 1.0:
        return 0.1
    else:
        # Linear interpolation: fewer looking → more candid
        return round(1.0 - (ratio_looking * 0.8), 2)


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
