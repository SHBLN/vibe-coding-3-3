from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.supabase_jwt import decode_supabase_token
from app.deps import CurrentUserId, DbSession, bearer_scheme
from app.models import Profile

router = APIRouter(prefix="/auth", tags=["auth"])

DEFAULT_UNSELECTED_ROLE = "Team Member"


def _is_role_selected(role: str | None) -> bool:
    if not role or not role.strip():
        return False
    return role.strip() != DEFAULT_UNSELECTED_ROLE


@router.get("/me")
def auth_me(
    db: DbSession,
    user_id: CurrentUserId,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    role = profile.role or UNSELECTED_ROLE
    profile_complete = _is_role_selected(role)

    email = ""
    if credentials is not None:
        payload = decode_supabase_token(credentials.credentials)
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
