from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from app.deps import CurrentUserId, DbSession
from app.models import Board, BoardColumn, Task
from app.services.access import boards_query_for_user, user_can_access_board
from app.services.board_view import (
    BACKLOG_STATUS_KEY,
    build_board_view,
    create_default_columns,
    map_list_board,
    seed_tasks_from_legacy_cards,
    slugify_status_key,
    unique_status_key,
)

router = APIRouter(prefix="/boards", tags=["boards"])


class BoardCreateBody(BaseModel):
    title: str
    description: str = ""


class BoardUpdateBody(BaseModel):
    title: str
    description: str


class ColumnCreateBody(BaseModel):
    title: str


class ColumnUpdateBody(BaseModel):
    title: str


class ColumnStateItem(BaseModel):
    id: str
    statusKey: str
    tasks: list[dict[str, Any]]


class SaveColumnsStateBody(BaseModel):
    columns: list[ColumnStateItem]


class ReindexColumnsBody(BaseModel):
    orderedColumnIds: list[str]


class DeleteColumnBody(BaseModel):
    columns: list[ColumnStateItem]


def _map_board_insert_error(message: str) -> HTTPException:
    text = message.strip()
    if "billing_subscription_required" in text:
        detail = text.split(":", 1)[-1].strip() or "Для создания проекта нужна активная подписка."
        return HTTPException(status_code=400, detail=f"billing_subscription_required: {detail}")
    if "billing_subscription_inactive" in text:
        detail = text.split(":", 1)[-1].strip() or "Подписка неактивна."
        return HTTPException(status_code=400, detail=f"billing_subscription_inactive: {detail}")
    if "light_board_limit" in text:
        detail = text.split(":", 1)[-1].strip() or "На тарифе Light доступен только 1 проект."
        return HTTPException(status_code=400, detail=f"light_board_limit: {detail}")
    return HTTPException(status_code=400, detail=text or "Не удалось создать доску.")


@router.get("")
def list_boards(db: DbSession, user_id: CurrentUserId) -> list[dict[str, Any]]:
    boards = boards_query_for_user(db, user_id).order_by(Board.updated_at.desc()).all()
    if not boards:
        return []

    board_ids = [b.id for b in boards]
    column_rows = (
        db.query(BoardColumn)
        .filter(BoardColumn.board_id.in_(board_ids))
        .order_by(BoardColumn.position.asc())
        .all()
    )
    by_board: dict[UUID, list[BoardColumn]] = {}
    for col in column_rows:
        by_board.setdefault(col.board_id, []).append(col)

    return [map_list_board(board, by_board.get(board.id, [])) for board in boards]


@router.post("")
def create_board(body: BoardCreateBody, db: DbSession, user_id: CurrentUserId) -> dict[str, Any]:
    board = Board(owner_id=user_id, title=body.title, description=body.description)
    db.add(board)
    try:
        db.flush()
        columns = create_default_columns(db, board.id)
        db.commit()
        db.refresh(board)
    except SQLAlchemyError as exc:
        db.rollback()
        raise _map_board_insert_error(str(exc.orig if hasattr(exc, "orig") else exc)) from exc

    return map_list_board(board, columns)


@router.patch("/{board_id}")
def update_board(
    board_id: UUID, body: BoardUpdateBody, db: DbSession, user_id: CurrentUserId
) -> dict[str, Any]:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    board.title = body.title
    board.description = body.description
    db.commit()
    db.refresh(board)

    columns = (
        db.query(BoardColumn)
        .filter(BoardColumn.board_id == board_id)
        .order_by(BoardColumn.position.asc())
        .all()
    )
    return map_list_board(board, columns)


@router.delete("/{board_id}", status_code=204)
def delete_board(board_id: UUID, db: DbSession, user_id: CurrentUserId) -> None:
    board = db.query(Board).filter(Board.id == board_id, Board.owner_id == user_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    db.delete(board)
    db.commit()


@router.get("/{board_id}/view")
def get_board_view(board_id: UUID, db: DbSession, user_id: CurrentUserId) -> dict[str, Any] | None:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        return None

    view = build_board_view(db, board)
    if view is None:
        return None
    return view


@router.post("/{board_id}/columns/state", status_code=204)
def save_columns_state(
    board_id: UUID, body: SaveColumnsStateBody, db: DbSession, user_id: CurrentUserId
) -> None:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    for column in body.columns:
        for index, task in enumerate(column.tasks):
            task_id = UUID(task["id"])
            db.query(Task).filter(Task.id == task_id, Task.board_id == board_id).update(
                {
                    Task.column_id: UUID(column.id),
                    Task.status: column.statusKey,
                    Task.position: index,
                },
                synchronize_session=False,
            )
    db.commit()


@router.post("/{board_id}/columns/reindex", status_code=204)
def reindex_columns(
    board_id: UUID, body: ReindexColumnsBody, db: DbSession, user_id: CurrentUserId
) -> None:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    for index, column_id in enumerate(body.orderedColumnIds):
        db.query(BoardColumn).filter(
            BoardColumn.id == UUID(column_id), BoardColumn.board_id == board_id
        ).update({BoardColumn.position: index}, synchronize_session=False)
    db.commit()


@router.post("/{board_id}/columns")
def create_column(
    board_id: UUID, body: ColumnCreateBody, db: DbSession, user_id: CurrentUserId
) -> dict[str, Any]:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    trimmed = body.title.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="Название колонки обязательно.")

    existing = (
        db.query(BoardColumn)
        .filter(BoardColumn.board_id == board_id)
        .order_by(BoardColumn.position.asc())
        .all()
    )
    existing_keys = {c.status_key for c in existing}
    status_key = unique_status_key(trimmed, existing_keys)

    column = BoardColumn(
        board_id=board_id,
        title=trimmed,
        status_key=status_key,
        position=len(existing),
        cards=[],
    )
    db.add(column)
    db.commit()
    db.refresh(column)

    return {
        "id": str(column.id),
        "title": column.title,
        "statusKey": column.status_key,
        "status": column.status_key,
        "tasks": [],
    }


@router.patch("/columns/{column_id}")
def update_column(
    column_id: UUID, body: ColumnUpdateBody, db: DbSession, user_id: CurrentUserId
) -> dict[str, str]:
    column = db.query(BoardColumn).filter(BoardColumn.id == column_id).first()
    if not column or not user_can_access_board(db, user_id, column.board_id):
        raise HTTPException(status_code=404, detail="Column not found")

    trimmed = body.title.strip()
    if not trimmed:
        raise HTTPException(status_code=400, detail="Название колонки обязательно.")

    column.title = trimmed
    db.commit()
    return {"id": str(column.id), "title": column.title}


@router.post("/{board_id}/columns/{column_id}/delete")
def delete_column(
    board_id: UUID,
    column_id: UUID,
    body: DeleteColumnBody,
    db: DbSession,
    user_id: CurrentUserId,
) -> list[dict[str, Any]]:
    if not user_can_access_board(db, user_id, board_id):
        raise HTTPException(status_code=404, detail="Board not found")

    columns_payload = body.columns
    column_to_delete = next((c for c in columns_payload if c.id == str(column_id)), None)
    if not column_to_delete:
        raise HTTPException(status_code=404, detail="Колонка не найдена.")
    if column_to_delete.statusKey == BACKLOG_STATUS_KEY:
        raise HTTPException(status_code=400, detail="Колонку Backlog нельзя удалить.")

    backlog = next((c for c in columns_payload if c.statusKey == BACKLOG_STATUS_KEY), None)
    if not backlog:
        raise HTTPException(status_code=400, detail="Колонка Backlog не найдена.")

    backlog_start = len(backlog.tasks)
    for index, task in enumerate(column_to_delete.tasks):
        task_id = task["id"] if isinstance(task, dict) else task.id
        db.query(Task).filter(Task.id == UUID(str(task_id)), Task.board_id == board_id).update(
            {
                Task.column_id: UUID(backlog.id),
                Task.status: backlog.statusKey,
                Task.position: backlog_start + index,
            },
            synchronize_session=False,
        )

    db.query(BoardColumn).filter(BoardColumn.id == column_id, BoardColumn.board_id == board_id).delete()
    db.commit()

    remaining = [c for c in columns_payload if c.id != str(column_id)]
    for index, col in enumerate(remaining):
        db.query(BoardColumn).filter(
            BoardColumn.id == UUID(col.id), BoardColumn.board_id == board_id
        ).update({BoardColumn.position: index}, synchronize_session=False)
    db.commit()

    moved_tasks = [{**t, "status": backlog.statusKey} for t in column_to_delete.tasks]
    result: list[dict[str, Any]] = []
    for col in remaining:
        if col.id == backlog.id:
            result.append(
                {
                    "id": col.id,
                    "title": col.title,
                    "statusKey": col.statusKey,
                    "status": col.statusKey,
                    "tasks": [*col.tasks, *moved_tasks],
                }
            )
        else:
            result.append(
                {
                    "id": col.id,
                    "title": col.title,
                    "statusKey": col.statusKey,
                    "status": col.statusKey,
                    "tasks": col.tasks,
                }
            )
    return result
