from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings


def _require_anon_key() -> str:
    key = settings.supabase_anon_key.strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_ANON_KEY не настроен на бэкенде.",
        )
    return key


def _auth_headers(anon_key: str) -> dict[str, str]:
    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }


def _extract_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        message = payload.get("msg") or payload.get("message") or payload.get("error_description")
        if isinstance(message, str) and message.strip():
            return message.strip()
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error.strip()
    return fallback


def supabase_sign_up(email: str, password: str, display_name: str, role: str) -> dict[str, Any]:
    anon_key = _require_anon_key()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/signup"

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            url,
            headers=_auth_headers(anon_key),
            json={
                "email": email,
                "password": password,
                "data": {
                    "display_name": display_name,
                    "role": role,
                },
            },
        )

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=_extract_error_message(payload, "Не удалось создать аккаунт."),
        )

    return payload if isinstance(payload, dict) else {}


def supabase_sign_in(email: str, password: str) -> dict[str, Any]:
    anon_key = _require_anon_key()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            url,
            headers=_auth_headers(anon_key),
            json={"email": email, "password": password},
        )

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=_extract_error_message(payload, "Не удалось выполнить вход."),
        )

    return payload if isinstance(payload, dict) else {}


def map_auth_response(payload: dict[str, Any]) -> dict[str, Any]:
    user = payload.get("user")
    if not isinstance(user, dict):
        user = None

    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    has_session = isinstance(access_token, str) and isinstance(refresh_token, str)

    mapped_user = None
    if user is not None:
        mapped_user = {
            "id": str(user.get("id") or ""),
            "email": user.get("email"),
        }

    return {
        "accessToken": access_token if has_session else None,
        "refreshToken": refresh_token if has_session else None,
        "user": mapped_user,
        "needsEmailConfirmation": not has_session,
    }
