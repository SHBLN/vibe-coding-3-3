from functools import lru_cache
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt
from jose.backends.rsa_backend import RSAKey

from app.config import settings


@lru_cache(maxsize=1)
def _fetch_jwks() -> dict[str, Any]:
    with httpx.Client(timeout=10.0) as client:
        response = client.get(settings.jwks_url)
        response.raise_for_status()
        return response.json()


def _get_signing_key(token: str) -> RSAKey | str:
    if settings.supabase_jwt_secret:
        return settings.supabase_jwt_secret

    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    jwks = _fetch_jwks()
    keys = jwks.get("keys", [])
    for key in keys:
        if key.get("kid") == kid:
            return RSAKey(key, algorithm=header.get("alg", "RS256"))
    if keys:
        return RSAKey(keys[0], algorithm=header.get("alg", "RS256"))
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWKS keys not found")


def decode_supabase_token(token: str) -> dict[str, Any]:
    try:
        options = {"verify_aud": False}
        if settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={**options, "verify_iss": False},
            )
            return payload

        key = _get_signing_key(token)
        payload = jwt.decode(
            token,
            key,
            algorithms=["HS256", "RS256"],
            issuer=settings.jwt_issuer,
            options=options,
        )
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc


def get_user_id_from_payload(payload: dict[str, Any]) -> UUID:
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing subject")
    try:
        return UUID(str(sub))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject") from exc
