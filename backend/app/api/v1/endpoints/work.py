"""부서별 후속 작업 API: 목록과 상태 변경."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.endpoint_helpers import get_task_or_404, run_in_transaction
from app.db.session import get_db
from app.repositories import task_repository
from app.schemas.task import serialize_task, serialize_tasks
from app.schemas.work import WorkStatusRequest
from app.services import workflow_service

router = APIRouter()


@router.get("/work")
def work(db: Session = Depends(get_db)) -> list[dict]:
    return serialize_tasks(task_repository.list_tasks(db, "work_item", newest_first=True))


@router.post("/work/{item_id}/status")
def change_work_status(item_id: int, body: WorkStatusRequest, db: Session = Depends(get_db)) -> dict:
    item = get_task_or_404(db, item_id, "work_item", "작업을 찾을 수 없습니다.")
    return serialize_task(run_in_transaction(db, workflow_service.set_work_status, item, body.status, body.actor))
