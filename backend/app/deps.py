from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.supabase_jwt import decode_supabase_token, get_user_id_from_payload
from app.db import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_supabase_token(credentials.credentials)
    return get_user_id_from_payload(payload)


DbSession = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
