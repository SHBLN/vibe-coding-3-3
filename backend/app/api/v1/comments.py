from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import joinedload

from app.deps import CurrentUserId, DbSession
from app.models import Task, TaskComment
from app.services.access import user_can_access_board
from app.services.board_view import _iso

router = APIRouter(tags=["comments"])


class CreateCommentBody(BaseModel):
    body: str = ""
    attachmentUrl: str | None = None
    attachmentName: str | None = None
    attachmentSize: int | None = None
    attachmentMime: str | None = None


def _map_comment(row: TaskComment) -> dict:
    return {
        "id": str(row.id),
        "taskId": str(row.task_id),
        "authorId": str(row.author_id),
        "authorName": row.author.display_name if row.author else "Пользователь",
        "body": row.body,
        "attachmentUrl": row.attachment_url,
        "attachmentName": row.attachment_name,
        "attachmentSize": row.attachment_size,
        "attachmentMime": row.attachment_mime,
        "createdAt": _iso(row.created_at) or "",
    }


@router.get("/tasks/{task_id}/comments")
def list_comments(task_id: UUID, db: DbSession, user_id: CurrentUserId) -> list[dict]:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or not user_can_access_board(db, user_id, task.board_id):
        raise HTTPException(status_code=404, detail="Task not found")

    rows = (
        db.query(TaskComment)
        .options(joinedload(TaskComment.author))
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )
    return [_map_comment(row) for row in rows]


@router.post("/tasks/{task_id}/comments")
def create_comment(
    task_id: UUID, body: CreateCommentBody, db: DbSession, user_id: CurrentUserId
) -> dict:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or not user_can_access_board(db, user_id, task.board_id):
        raise HTTPException(status_code=404, detail="Task not found")

    trimmed = body.body.strip()
    if not trimmed and not body.attachmentUrl:
        raise HTTPException(status_code=400, detail="Введите комментарий или прикрепите файл.")

    comment = TaskComment(
        task_id=task_id,
        author_id=user_id,
        body=trimmed,
        attachment_url=body.attachmentUrl,
        attachment_name=body.attachmentName,
        attachment_size=body.attachmentSize,
        attachment_mime=body.attachmentMime,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    row = (
        db.query(TaskComment)
        .options(joinedload(TaskComment.author))
        .filter(TaskComment.id == comment.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=500, detail="Comment not found after insert")
    return _map_comment(row)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: UUID, db: DbSession, user_id: CurrentUserId) -> None:
    comment = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not comment or comment.author_id != user_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
