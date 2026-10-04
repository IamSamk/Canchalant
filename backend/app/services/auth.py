"""
Canchalant — Authentication & Security Service

Handles password hashing (bcrypt), JSON Web Token (PyJWT) creation/verification,
and FastAPI authentication dependencies.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.config import get_settings
from backend.app.models.schemas import UserProfile

logger = logging.getLogger(__name__)

# HTTPBearer authorization header extractor (supports Bearer <token>)
_bearer_security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash plaintext password with bcrypt."""
    pw_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    try:
        pw_bytes = plain_password.encode("utf-8")
        h_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, h_bytes)
    except Exception as e:
        logger.error("Error verifying password: %s", e)
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create signed HS256 JWT access token."""
    settings = get_settings()
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT token."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("Invalid JWT token: %s", e)
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_security),
) -> UserProfile:
    """
    FastAPI dependency that enforces authentication.
    Resolves the authenticated user from the database or token payload.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access your memory vault.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid credentials. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(payload.get("sub"))
    email = str(payload.get("email", ""))
    name = str(payload.get("name", ""))

    # Lazy-import db to prevent circular import
    from backend.app.services import db
    user_doc = await db.get_user_by_id(user_id)
    if not user_doc:
        # Fallback to token claims if DB temporarily unreachable
        return UserProfile(
            id=user_id,
            email=email,
            name=name,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    return UserProfile(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc.get("name", ""),
        created_at=user_doc.get("created_at", ""),
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_security),
) -> Optional[UserProfile]:
    """FastAPI dependency for optional authentication."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
