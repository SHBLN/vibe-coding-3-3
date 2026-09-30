import re
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models import Board, BoardColumn, BoardMember, Profile, Task, TaskAssignee

BACKLOG_STATUS_KEY = "backlog"

DEFAULT_COLUMNS = [
    {"title": "Backlog", "status_key": "backlog"},
    {"title": "In progress", "status_key": "in_progress"},
    {"title": "Review", "status_key": "review"},
    {"title": "Done", "status_key": "done"},
]


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat().replace("+00:00", "Z") if dt.tzinfo else dt.isoformat() + "Z"


def _profile_initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def parse_cards(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def slugify_status_key(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", title.strip().lower()).strip("_")[:40]
    return base or "column"


def unique_status_key(title: str, existing_keys: set[str]) -> str:
    base = slugify_status_key(title)
    if base not in existing_keys:
        return base
    index = 2
    while f"{base}_{index}" in existing_keys:
        index += 1
    return f"{base}_{index}"


def seed_tasks_from_legacy_cards(db: Session, board_id: UUID, column_rows: list[BoardColumn]) -> None:
    count = db.query(Task).filter(Task.board_id == board_id).count()
    if count > 0:
        return

    inserts: list[Task] = []
    for column in sorted(column_rows, key=lambda c: c.position):
        for index, title in enumerate(parse_cards(column.cards)):
            inserts.append(
                Task(
                    board_id=board_id,
                    column_id=column.id,
                    title=title,
                    status=column.status_key,
                    kind="task",
                    position=index,
                    tags=[],
                )
            )
    if inserts:
        db.add_all(inserts)
        db.commit()


def map_board_task(row: Task, parent_titles: dict[UUID, str]) -> dict[str, Any]:
    assignee_ids = [str(a.profile_id) for a in row.assignees]
    assignee_names = [
        a.profile.display_name for a in row.assignees if a.profile is not None
    ]
    primary_name = assignee_names[0] if assignee_names else None

    kind = row.kind if row.kind in ("task", "epic") else "task"
    priority = row.priority if row.priority in ("low", "medium", "high") else "medium"

    return {
        "id": str(row.id),
        "title": row.title,
        "status": row.status,
        "kind": kind,
        "priority": priority,
        "description": row.description,
        "assigneeId": assignee_ids[0] if assignee_ids else None,
        "assigneeIds": assignee_ids,
        "assigneeName": primary_name,
        "assigneeNames": assignee_names,
        "assigneeInitials": _profile_initials(primary_name) if primary_name else None,
        "dueAt": _iso(row.due_at),
        "parentTitle": parent_titles.get(row.parent_id) if row.parent_id else None,
        "tags": row.tags if isinstance(row.tags, list) else [],
    }


def build_board_view(db: Session, board: Board) -> dict[str, Any]:
    column_rows = (
        db.query(BoardColumn)
        .filter(BoardColumn.board_id == board.id)
        .order_by(BoardColumn.position.asc())
        .all()
    )
    if not column_rows:
        return None  # type: ignore[return-value]

    seed_tasks_from_legacy_cards(db, board.id, column_rows)

    task_rows = (
        db.query(Task)
        .options(joinedload(Task.assignees).joinedload(TaskAssignee.profile))
        .filter(Task.board_id == board.id)
        .order_by(Task.position.asc())
        .all()
    )

    parent_titles = {t.id: t.title for t in task_rows}
    tasks_by_column: dict[UUID, list[dict[str, Any]]] = {c.id: [] for c in column_rows}
    for task_row in task_rows:
        mapped = map_board_task(task_row, parent_titles)
        tasks_by_column.get(task_row.column_id, []).append(mapped)

    member_ids = [
        str(row.profile_id)
        for row in db.query(BoardMember).filter(BoardMember.board_id == board.id).all()
    ]

    columns = [
        {
            "id": str(col.id),
            "title": col.title,
            "statusKey": col.status_key,
            "status": col.status_key,
            "tasks": tasks_by_column.get(col.id, []),
        }
        for col in sorted(column_rows, key=lambda c: c.position)
    ]

    return {
        "id": str(board.id),
        "title": board.title,
        "description": board.description,
        "updatedAt": _iso(board.updated_at) or "",
        "memberIds": member_ids,
        "columns": columns,
    }


def map_list_board(board: Board, columns: list[BoardColumn]) -> dict[str, Any]:
    return {
        "id": str(board.id),
        "title": board.title,
        "description": board.description,
        "createdAt": _iso(board.created_at) or "",
        "updatedAt": _iso(board.updated_at) or "",
        "columns": [
            {
                "id": str(col.id),
                "title": col.title,
                "cards": parse_cards(col.cards),
            }
            for col in sorted(columns, key=lambda c: c.position)
        ],
    }


def create_default_columns(db: Session, board_id: UUID) -> list[BoardColumn]:
    rows: list[BoardColumn] = []
    for index, col in enumerate(DEFAULT_COLUMNS):
        row = BoardColumn(
            board_id=board_id,
            title=col["title"],
            status_key=col["status_key"],
            position=index,
            cards=[],
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows
