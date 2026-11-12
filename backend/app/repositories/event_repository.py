"""events(처리 이력) 테이블 조회·추가·삭제. commit 은 하지 않는다."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event


def add_event(db: Session, task_id: int | None, actor: str, action: str, note: str = "", detail: dict | None = None) -> None:
    db.add(Event(task_id=task_id, actor=actor, action=action, note=note, detail=detail or {}))


def list_recent_events(db: Session, limit: int, task_id: int | None = None) -> list[Event]:
    """최근 것부터 limit 건. task_id 를 주면 그 건의 이력만."""
    query = select(Event).order_by(Event.id.desc()).limit(limit)
    if task_id is not None:
        query = query.where(Event.task_id == task_id)
    return list(db.scalars(query).all())


def list_events_of_task(db: Session, task_id: int) -> list[Event]:
    """한 건의 이력 전체를 일어난 순서대로."""
    return list(db.scalars(select(Event).where(Event.task_id == task_id).order_by(Event.id)).all())


def delete_all_events(db: Session) -> None:
    db.query(Event).delete()
