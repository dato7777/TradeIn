"""Supabase JWT authentication (ES256 via JWKS, HS256 legacy fallback)."""

from __future__ import annotations

import time
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import get_settings

security = HTTPBearer(auto_error=False)

_jwks_cache: dict[str, Any] | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 300


def _jwks_url() -> str:
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json"


def _fetch_jwks(*, force: bool = False) -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if not force and _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache
    try:
        response = httpx.get(_jwks_url(), timeout=10.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_fetched_at = now
        return _jwks_cache
    except httpx.HTTPError as exc:
        if _jwks_cache:
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch Supabase JWKS for token verification",
        ) from exc


def _decode_es256(token: str, jwks: dict[str, Any]) -> dict[str, Any]:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    keys = jwks.get("keys") or []
    candidates = [k for k in keys if not kid or k.get("kid") == kid]
    if not candidates:
        candidates = keys

    last_error: JWTError | None = None
    for key_data in candidates:
        algorithm = key_data.get("alg", "ES256")
        try:
            public_key = jwk.construct(key_data)
            return jwt.decode(
                token,
                public_key,
                algorithms=[algorithm],
                audience="authenticated",
            )
        except JWTError as exc:
            last_error = exc
            continue

    raise last_error or JWTError("No matching JWKS key found")


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg", "HS256")

    try:
        if algorithm == "HS256":
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        if algorithm in ("ES256", "RS256"):
            return _decode_es256(token, _fetch_jwks())

        raise JWTError(f"Unsupported JWT algorithm: {algorithm}")
    except JWTError:
        # Retry once with a fresh JWKS (key rotation / stale cache)
        if algorithm in ("ES256", "RS256"):
            try:
                return _decode_es256(token, _fetch_jwks(force=True))
            except JWTError as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                ) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None


def _email_from_payload(payload: dict[str, Any]) -> str:
    email = payload.get("email")
    if not email:
        meta = payload.get("user_metadata") or {}
        if isinstance(meta, dict):
            email = meta.get("email")
    return (email or "").lower()


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    email = _email_from_payload(payload)
    settings = get_settings()
    role = "admin" if email and email in settings.admin_email_list else "viewer"
    return {
        "user_id": payload.get("sub"),
        "email": email,
        "role": role,
        "token": credentials.credentials,
    }


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
