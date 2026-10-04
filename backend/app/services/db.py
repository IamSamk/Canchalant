"""
Canchalant — MongoDB Atlas & Vector Search Layer

Asynchronous database integration using Motor (AsyncIOMotorClient) targeting:
- Database: `canchalant`
- Collection: `moments`
- Atlas Vector Search: `$vectorSearch` aggregation stage on 512-dim CLIP vectors
- Cloudinary media URL persistence

Includes a local persistent replica for resilient operation if MongoDB Atlas
network access (IP whitelist) is temporarily restricted.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import certifi
import numpy as np
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, PyMongoError

from backend.app.core.config import get_settings
from backend.app.models.schemas import Classification, MomentDocument
from backend.app.services import storage

logger = logging.getLogger(__name__)

# Local backup store path
_LOCAL_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "moments_store.json"
_LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None
_atlas_available: bool | None = None


# ── Local Backup Persistence Helpers ──────────────────────────────

def _read_local_store() -> List[Dict[str, Any]]:
    """Read local moments backup file."""
    if not _LOCAL_STORE_PATH.exists():
        return []
    try:
        with open(_LOCAL_STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Error reading local moments store: %s", e)
        return []


def _write_local_store(data: List[Dict[str, Any]]):
    """Write to local moments backup file."""
    try:
        with open(_LOCAL_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("Error writing local moments store: %s", e)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    na = np.linalg.norm(va)
    nb = np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


# ── MongoDB Connection ────────────────────────────────────────────

async def get_database() -> AsyncIOMotorDatabase:
    """Initialize or return AsyncIOMotorDatabase with certifi CA bundle."""
    global _client, _db, _atlas_available

    if _db is None:
        settings = get_settings()
        logger.info(
            "Connecting to MongoDB Atlas (db: %s, collection: %s)...",
            settings.mongodb_db_name,
            settings.mongodb_collection,
        )
        try:
            _client = AsyncIOMotorClient(
                settings.mongodb_uri,
                tlsCAFile=certifi.where(),
                maxPoolSize=20,
                minPoolSize=1,
                serverSelectionTimeoutMS=4000,
                connectTimeoutMS=4000,
            )
            _db = _client[settings.mongodb_db_name]
            await _client.admin.command("ping")
            _atlas_available = True
            logger.info("MongoDB Atlas connected successfully: db=%s", settings.mongodb_db_name)
        except Exception as e:
            _atlas_available = False
            logger.warning(
                "MongoDB Atlas handshake failed: %s. (Active with resilient local store). "
                "Ensure your IP is added to Atlas Network Access IP Access List.",
                e,
            )
            # Retain db instance object for retry attempts
            if _client:
                _db = _client[settings.mongodb_db_name]

    return _db


async def get_collection():
    """Retrieve moments collection."""
    settings = get_settings()
    db = await get_database()
    return db[settings.mongodb_collection]


async def close_database():
    """Gracefully terminate database connections."""
    global _client, _db, _atlas_available
    if _client:
        _client.close()
        _client = None
        _db = None
        _atlas_available = None
        logger.info("MongoDB connection closed.")


# ── CRUD Operations ───────────────────────────────────────────────

async def save_moment(moment: MomentDocument) -> str:
    """
    Persist captured moment in MongoDB Atlas and local backup.

    Returns:
        The moment id.
    """
    doc = moment.model_dump()

    # Always persist locally for safety
    local_data = _read_local_store()
    local_data = [m for m in local_data if m.get("id") != moment.id]
    local_data.insert(0, doc)
    _write_local_store(local_data)

    # Attempt MongoDB Atlas insert
    try:
        coll = await get_collection()
        await coll.insert_one(doc.copy())
        logger.info(
            "Saved moment to Atlas: id=%s url=%s class=%s conf=%.2f",
            moment.id, moment.cloudinary_url, moment.classification, moment.confidence,
        )
    except Exception as e:
        logger.warning("Atlas insert skipped (%s); saved to local backup store.", e)

    return moment.id


async def get_moments(
    page: int = 1,
    limit: int = 20,
    classification: Optional[Classification] = None,
    tag: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Paginated moments gallery with optional classification and tag filters."""
    # Attempt Atlas first
    try:
        coll = await get_collection()
        query: Dict[str, Any] = {}
        if classification:
            query["classification"] = classification.value
        if tag:
            query["tags"] = tag.lower()

        skip = (page - 1) * limit
        cursor = coll.find(query, {"embedding": 0}).sort("created_at", -1).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)
        for doc in results:
            doc.pop("_id", None)
        if results:
            return results
    except Exception as e:
        logger.debug("Reading from local store fallback (Atlas: %s)", e)

    # Local fallback
    items = _read_local_store()
    if classification:
        items = [m for m in items if m.get("classification") == classification.value]
    if tag:
        t = tag.lower()
        items = [m for m in items if t in [str(x).lower() for x in m.get("tags", [])]]

    # Sort descending by created_at
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    start = (page - 1) * limit
    paged = items[start : start + limit]

    # Clean embeddings from response
    cleaned = []
    for item in paged:
        c = item.copy()
        c.pop("embedding", None)
        c.pop("_id", None)
        cleaned.append(c)

    return cleaned


async def search_moments(
    query_vector: List[float],
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    Vector search using MongoDB Atlas `$vectorSearch` aggregation stage.
    Falls back to local cosine ranking if Atlas is unavailable.
    """
    settings = get_settings()

    # 1. Atlas Vector Search
    try:
        coll = await get_collection()
        pipeline = [
            {
                "$vectorSearch": {
                    "index": settings.mongodb_vector_index_name,
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": min(limit * 5, 200),
                    "limit": limit,
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "embedding": 0,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]
        cursor = coll.aggregate(pipeline)
        results = await cursor.to_list(length=limit)
        if results:
            return results
    except Exception as e:
        logger.debug("Atlas vector search fallback triggered: %s", e)

    # 2. Local vector similarity ranking fallback
    items = _read_local_store()
    scored = []
    for item in items:
        emb = item.get("embedding")
        if emb and len(emb) == len(query_vector):
            score = _cosine_similarity(query_vector, emb)
            c = item.copy()
            c.pop("embedding", None)
            c.pop("_id", None)
            c["score"] = round(score, 4)
            scored.append(c)

    scored.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    return scored[:limit]


async def delete_moment(moment_id: str) -> bool:
    """
    Delete moment by ID — removes record from MongoDB/local store
    and removes the asset from Cloudinary.
    """
    found_doc: Optional[Dict[str, Any]] = None

    # Check local store
    local_data = _read_local_store()
    for item in local_data:
        if item.get("id") == moment_id:
            found_doc = item
            break
    if found_doc:
        local_data = [m for m in local_data if m.get("id") != moment_id]
        _write_local_store(local_data)

    # Delete from Atlas
    try:
        coll = await get_collection()
        atlas_doc = await coll.find_one_and_delete({"id": moment_id})
        if atlas_doc and not found_doc:
            found_doc = atlas_doc
    except Exception as e:
        logger.warning("Atlas delete failed: %s", e)

    # Delete Cloudinary asset
    if found_doc:
        pub_id = found_doc.get("cloudinary_public_id")
        if pub_id:
            storage.delete_image(pub_id)
        return True

    return False


async def get_total_count(
    classification: Optional[Classification] = None,
    tag: Optional[str] = None,
) -> int:
    """Retrieve total count of matching moments."""
    try:
        coll = await get_collection()
        query: Dict[str, Any] = {}
        if classification:
            query["classification"] = classification.value
        if tag:
            query["tags"] = tag.lower()
        return await coll.count_documents(query)
    except Exception:
        items = _read_local_store()
        if classification:
            items = [m for m in items if m.get("classification") == classification.value]
        if tag:
            t = tag.lower()
            items = [m for m in items if t in [str(x).lower() for x in m.get("tags", [])]]
        return len(items)


# ── Health Check ──────────────────────────────────────────────────

async def check_health() -> str:
    """Verify MongoDB connectivity."""
    try:
        db = await get_database()
        await db.command("ping")
        return "connected"
    except Exception as e:
        return f"standby (local store active: {e})"
