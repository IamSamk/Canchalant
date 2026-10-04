"""
Canchalant — Cloudinary Media Storage

Handles uploading captured candid photos directly to Cloudinary
under the `canchalant_snaps` folder and returning secure HTTPS URLs
for persistence in MongoDB Atlas.
"""

from __future__ import annotations

import io
import logging
from typing import Dict, Optional

import cloudinary
import cloudinary.api
import cloudinary.uploader

from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

_initialized = False


def _init_cloudinary():
    """Configure Cloudinary SDK using application settings."""
    global _initialized
    if not _initialized:
        settings = get_settings()
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
        _initialized = True
        logger.info(
            "Cloudinary SDK initialized: cloud_name=%s folder=%s",
            settings.cloudinary_cloud_name,
            settings.cloudinary_folder,
        )


def upload_image(image_bytes: bytes, filename: str) -> Dict[str, str]:
    """
    Upload raw image bytes to Cloudinary.

    Args:
        image_bytes: Raw JPEG/PNG image bytes.
        filename: Base filename without directory.

    Returns:
        Dict with keys:
          - 'secure_url': The HTTPS URL to the uploaded asset
          - 'public_id': Cloudinary public ID for deletion
    """
    _init_cloudinary()
    settings = get_settings()

    # Strip extension for public_id
    base_id = filename.rsplit(".", 1)[0]
    folder = settings.cloudinary_folder

    try:
        response = cloudinary.uploader.upload(
            io.BytesIO(image_bytes),
            folder=folder,
            public_id=base_id,
            resource_type="image",
            overwrite=True,
            tags=["canchalant", "candid_photo"],
        )

        secure_url = response.get("secure_url", "")
        public_id = response.get("public_id", f"{folder}/{base_id}")

        logger.info("Uploaded to Cloudinary: public_id=%s url=%s", public_id, secure_url)
        return {
            "secure_url": secure_url,
            "public_id": public_id,
        }

    except Exception as e:
        logger.error("Cloudinary upload failed: %s", e)
        raise RuntimeError(f"Cloudinary upload failed: {e}") from e


def delete_image(public_id: str) -> bool:
    """
    Delete an image asset from Cloudinary by its public ID.

    Returns:
        True if deleted or acknowledged.
    """
    _init_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        logger.info("Cloudinary deletion for %s: %s", public_id, result)
        return result.get("result") in ("ok", "not found")
    except Exception as e:
        logger.error("Failed to delete Cloudinary asset %s: %s", public_id, e)
        return False


def check_health() -> str:
    """Verify Cloudinary API connectivity."""
    try:
        _init_cloudinary()
        res = cloudinary.api.ping()
        if res.get("status") == "ok":
            return "connected"
        return str(res)
    except Exception as e:
        return f"error: {e}"
