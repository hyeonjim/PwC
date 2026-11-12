"""처리 이력 API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import event_repository
from app.schemas.task import serialize_events

router = APIRouter()


@router.get("/events")
def events(case_id: int | None = None, limit: int = 200, db: Session = Depends(get_db)) -> list[dict]:
    return serialize_events(event_repository.list_recent_events(db, limit, task_id=case_id))
