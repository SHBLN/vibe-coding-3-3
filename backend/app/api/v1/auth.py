from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app.auth.supabase_jwt import decode_supabase_token
from app.deps import CurrentUserId, DbSession, bearer_scheme
from app.models import Profile
from app.services.supabase_auth import map_auth_response, supabase_sign_in, supabase_sign_up

router = APIRouter(prefix="/auth", tags=["auth"])

DEFAULT_UNSELECTED_ROLE = "Team Member"


class SignUpBody(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    displayName: str = Field(min_length=1)
    role: str = Field(min_length=1)


class SignInBody(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


def _upsert_profile(db: DbSession, user_id: UUID, display_name: str, role: str) -> None:
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if profile:
        profile.display_name = display_name
        profile.role = role
    else:
        db.add(Profile(id=user_id, display_name=display_name, role=role))
    db.commit()


def _is_role_selected(role: str | None) -> bool:
    if not role or not role.strip():
        return False
    return role.strip() != DEFAULT_UNSELECTED_ROLE


def _account_from_jwt(token: str) -> dict[str, Any]:
    payload = decode_supabase_token(token)
    metadata = payload.get("user_metadata") or {}
    role = str(metadata.get("role") or DEFAULT_UNSELECTED_ROLE)
    email = str(payload.get("email") or "")
    display_name = str(metadata.get("display_name") or email.split("@")[0] or "Пользователь")

    return {
        "id": str(payload.get("sub") or ""),
        "email": email,
        "displayName": display_name,
        "role": role,
        "profileComplete": _is_role_selected(role),
        "avatarPreset": None,
        "avatarUrl": None,
    }


@router.post("/signup")
def auth_signup(body: SignUpBody, db: DbSession) -> dict[str, Any]:
    payload = supabase_sign_up(body.email, body.password, body.displayName.strip(), body.role)
    mapped = map_auth_response(payload)

    user = mapped.get("user")
    if user and user.get("id") and not mapped["needsEmailConfirmation"]:
        try:
            _upsert_profile(db, UUID(str(user["id"])), body.displayName.strip(), body.role)
        except SQLAlchemyError:
            db.rollback()

    return mapped


@router.post("/signin")
def auth_signin(body: SignInBody) -> dict[str, Any]:
    payload = supabase_sign_in(body.email, body.password)
    return map_auth_response(payload)


@router.get("/me")
def auth_me(
    db: DbSession,
    user_id: CurrentUserId,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    token = credentials.credentials if credentials is not None else None

    try:
        profile = db.query(Profile).filter(Profile.id == user_id).first()
    except SQLAlchemyError:
        if token:
            return _account_from_jwt(token)
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not profile:
        if token:
            return _account_from_jwt(token)
        raise HTTPException(status_code=404, detail="Profile not found")

    role = profile.role or DEFAULT_UNSELECTED_ROLE
    profile_complete = _is_role_selected(role)

    email = ""
    if token:
        payload = decode_supabase_token(token)
        email = str(payload.get("email") or "")

    return {
        "id": str(profile.id),
        "email": email,
        "displayName": profile.display_name,
        "role": role,
        "profileComplete": profile_complete,
        "avatarPreset": profile.avatar_preset,
        "avatarUrl": profile.avatar_url,
    }
