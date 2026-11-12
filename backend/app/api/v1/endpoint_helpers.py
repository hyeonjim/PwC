"""여러 엔드포인트가 같이 쓰는 처리: 저장·롤백, 404."""

from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Task
from app.repositories import task_repository
from app.services import workflow_service
from app.services.workflow_service import WorkflowError

Result = TypeVar("Result")


def run_in_transaction(db: Session, action: Callable[..., Result], *args: Any, **kwargs: Any) -> Result:
    """업무 규칙 위반은 400 으로 돌려주고, 성공하면 저장(commit)한다."""
    try:
        result = action(db, *args, **kwargs)
        db.commit()
        return result
    except WorkflowError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def get_case_or_404(db: Session, case_id: int) -> Task:
    try:
        return workflow_service.get_case(db, case_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def get_task_or_404(db: Session, task_id: int, kind: str, not_found_message: str) -> Task:
    task = task_repository.get_task_of_kind(db, task_id, kind)
    if task is None:
        raise HTTPException(status_code=404, detail=not_found_message)
    return task
