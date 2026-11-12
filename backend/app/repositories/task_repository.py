"""tasks 테이블 조회·추가·삭제. commit 은 하지 않는다(엔드포인트에서 한 번에 한다)."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task


def get_task(db: Session, task_id: int | None) -> Task | None:
    if task_id is None:
        return None
    return db.get(Task, task_id)


def get_task_of_kind(db: Session, task_id: int, kind: str) -> Task | None:
    """id 로 찾되 종류가 다르면 없는 것으로 본다."""
    task = get_task(db, task_id)
    return task if task is not None and task.kind == kind else None


def list_tasks(db: Session, kind: str, newest_first: bool = False, **payload_match: Any) -> list[Task]:
    """종류별 목록. payload_match 로 payload 값이 같은 것만 고른다. 예: case_id=3"""
    order = Task.id.desc() if newest_first else Task.id
    rows = db.scalars(select(Task).where(Task.kind == kind).order_by(order)).all()
    return [task for task in rows if all(task.payload.get(key) == value for key, value in payload_match.items())]


def add_task(db: Session, task: Task) -> Task:
    """추가하고 flush 해서 id 를 받아 둔다."""
    db.add(task)
    db.flush()
    return task


def delete_all_tasks(db: Session) -> None:
    db.query(Task).delete()
