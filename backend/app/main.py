"""
Canchalant — FastAPI Application Entry Point

Mounts the REST API router, configures CORS for the React frontend,
serves captured photos as static files, and manages MongoDB lifecycle.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api.endpoints import router
from backend.app.core.config import get_settings
from backend.app.services import db, storage

# ── Logging ───────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-5s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("canchalant")


# ── Lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hooks."""
    settings = get_settings()
    logger.info("🎯 Canchalant starting up...")
    logger.info("   Cloudinary: %s (folder: %s)", settings.cloudinary_cloud_name, settings.cloudinary_folder)
    logger.info("   MongoDB: %s / %s", settings.mongodb_db_name, settings.mongodb_collection)
    logger.info("   Hugging Face Vision: %s", settings.hf_vision_model)
    logger.info("   Device: %s", settings.device)

    # Initialize Cloudinary
    storage.check_health()

    # Pre-warm MongoDB connection
    try:
        await db.get_database()
    except Exception as e:
        logger.warning("MongoDB connection deferred: %s", e)

    yield

    # Shutdown
    await db.close_database()
    logger.info("👋 Canchalant shut down.")


# ── App ───────────────────────────────────────────────────────────

app = FastAPI(
    title="Canchalant",
    description="Intelligent Private Ambient Photo Assistant & Semantic Memory Gallery",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React dev server, Vercel deployments, and dynamic origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for local fallback photos
settings = get_settings()
settings.storage_path.mkdir(parents=True, exist_ok=True)
app.mount(
    "/captured_photos",
    StaticFiles(directory=str(settings.storage_path)),
    name="captured_photos",
)

# Include API router
app.include_router(router)


@app.get("/")
async def root():
    return {
        "app": "Canchalant",
        "version": "1.0.0",
        "docs": "/docs",
        "description": "Candid + Nonchalant — Your private ambient photo memory.",
    }
