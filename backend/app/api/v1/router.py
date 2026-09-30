from fastapi import APIRouter

from app.api.v1 import auth, boards, comments, tasks

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(boards.router)
api_router.include_router(tasks.router)
api_router.include_router(comments.router)
