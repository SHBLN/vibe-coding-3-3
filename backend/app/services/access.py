from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Board, BoardMember


def accessible_board_ids(db: Session, user_id: UUID) -> set[UUID]:
    owned = select(Board.id).where(Board.owner_id == user_id)
    member = select(BoardMember.board_id).where(BoardMember.profile_id == user_id)
    rows = db.execute(owned.union(member)).scalars().all()
    return set(rows)


def user_can_access_board(db: Session, user_id: UUID, board_id: UUID) -> bool:
    return board_id in accessible_board_ids(db, user_id)


def boards_query_for_user(db: Session, user_id: UUID):
    member_board_ids = select(BoardMember.board_id).where(BoardMember.profile_id == user_id)
    return db.query(Board).filter(or_(Board.owner_id == user_id, Board.id.in_(member_board_ids)))
