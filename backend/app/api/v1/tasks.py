from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import joinedload

from app.deps import CurrentUserId, DbSession
from app.models import Task, TaskAssignee
from app.services.access import user_can_access_board
from app.services.board_view import map_board_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


class CreateTaskBody(BaseModel):
    boardId: str
    columnId: str
    status: str
    title: str
    priority: str = "medium"
    description: str | None = None
    dueAt: str | None = None
    assigneeIds: list[str] = []


class UpdateTaskBody(BaseModel):
    boardId: str
    title: str
    priority: str = "medium"
    description: str | None = None
    dueAt: str | None = None
    assigneeIds: list[str] = []


class DeleteTaskBody(BaseModel):
    boardId: str
    columnId: str
    status: str
    remainingTaskIds: list[str]


class BulkDeleteBody(BaseModel):
    boardId: str
    taskIds: list[str]
    columns: list[dict[str, Any]]


class SyncAssigneesBody(BaseModel):
    assigneeIds: list[str]


def _fetch_task(db: DbSession, task_id: UUID, board_id: UUID) -> dict[str, Any]:
    row = (
        db.query(Task)
        .options(joinedload(Task.assignees).joinedload(TaskAssignee.profile))
        .filter(Task.id == task_id, Task.board_id == board_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Задача не найдена.")
    parent_titles = {row.id: row.title}
    return map_board_task(row, parent_titles)


def _normalize_column_positions(
    db: DbSession, board_id: UUID, column_id: UUID, status: str, ordered_task_ids: list[str]
) -> None:
    for index, task_id in enumerate(ordered_task_ids):
        db.query(Task).filter(Task.id == UUID(task_id), Task.board_id == board_id).update(
            {
                Task.position: index,
                Task.status: status,
                Task.column_id: column_id,
            },
            synchronize_session=False,
        )


@router.post("")
def create_task(body: CreateTaskBody, db: DbSession, user_id: CurrentUserId) -> dict[str, Any]:
    board_id = UUID(body.boardId)
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    count = (
        db.query(Task)
        .filter(Task.board_id == board_id, Task.column_id == UUID(body.columnId))
        .count()
    )

    task = Task(
        board_id=board_id,
        column_id=UUID(body.columnId),
        title=body.title,
        status=body.status,
        kind="task",
        priority=body.priority,
        description=body.description,
        due_at=body.dueAt,
        position=count,
        tags=[],
    )
    db.add(task)
    db.flush()

    if body.assigneeIds:
        db.add_all(
            [
                TaskAssignee(task_id=task.id, profile_id=UUID(pid))
                for pid in body.assigneeIds
            ]
        )

    db.commit()
    return _fetch_task(db, task.id, board_id)


@router.patch("/{task_id}")
def update_task(
    task_id: UUID, body: UpdateTaskBody, db: DbSession, user_id: CurrentUserId
) -> dict[str, Any]:
    board_id = UUID(body.boardId)
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    updated = (
        db.query(Task)
        .filter(Task.id == task_id, Task.board_id == board_id)
        .update(
            {
                Task.title: body.title,
                Task.priority: body.priority,
                Task.description: body.description,
                Task.due_at: body.dueAt,
            },
            synchronize_session=False,
        )
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Задача не найдена.")

    existing = (
        db.query(TaskAssignee.profile_id)
        .filter(TaskAssignee.task_id == task_id)
        .all()
    )
    existing_ids = {row[0] for row in existing}
    next_ids = {UUID(pid) for pid in body.assigneeIds}

    to_delete = existing_ids - next_ids
    to_add = next_ids - existing_ids

    if to_delete:
        db.query(TaskAssignee).filter(
            TaskAssignee.task_id == task_id, TaskAssignee.profile_id.in_(to_delete)
        ).delete(synchronize_session=False)

    for profile_id in to_add:
        db.add(TaskAssignee(task_id=task_id, profile_id=profile_id))

    db.commit()
    return _fetch_task(db, task_id, board_id)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: UUID, body: DeleteTaskBody, db: DbSession, user_id: CurrentUserId
) -> None:
    board_id = UUID(body.boardId)
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    deleted = db.query(Task).filter(Task.id == task_id, Task.board_id == board_id).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Задача не найдена.")

    _normalize_column_positions(
        db,
        board_id,
        UUID(body.columnId),
        body.status,
        body.remainingTaskIds,
    )
    db.commit()


@router.post("/bulk-delete", status_code=204)
def bulk_delete_tasks(body: BulkDeleteBody, db: DbSession, user_id: CurrentUserId) -> None:
    board_id = UUID(body.boardId)
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    if not body.taskIds:
        return

    ids_to_delete = {UUID(tid) for tid in body.taskIds}
    db.query(Task).filter(Task.board_id == board_id, Task.id.in_(ids_to_delete)).delete(
        synchronize_session=False
    )

    for column in body.columns:
        column_id = UUID(column["id"])
        status_key = column["statusKey"]
        tasks = column.get("tasks", [])
        remaining = [t["id"] for t in tasks if UUID(t["id"]) not in ids_to_delete]
        _normalize_column_positions(db, board_id, column_id, status_key, remaining)

    db.commit()


@router.post("/{task_id}/assignees/sync", status_code=204)
def sync_assignees(
    task_id: UUID, body: SyncAssigneesBody, db: DbSession, user_id: CurrentUserId
) -> None:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or not user_can_access_board(db, user_id, task.board_id):
        raise HTTPException(status_code=404, detail="Task not found")

    existing = (
        db.query(TaskAssignee.profile_id).filter(TaskAssignee.task_id == task_id).all()
    )
    existing_ids = {row[0] for row in existing}
    next_ids = {UUID(pid) for pid in body.assigneeIds}

    to_delete = existing_ids - next_ids
    to_add = next_ids - existing_ids

    if to_delete:
        db.query(TaskAssignee).filter(
            TaskAssignee.task_id == task_id, TaskAssignee.profile_id.in_(to_delete)
        ).delete(synchronize_session=False)

    for profile_id in to_add:
        db.add(TaskAssignee(task_id=task_id, profile_id=profile_id))

    db.commit()
