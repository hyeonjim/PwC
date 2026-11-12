"""승인 API: 목록과 모의 회신."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.endpoint_helpers import get_task_or_404, run_in_transaction
from app.db.session import get_db
from app.repositories import task_repository
from app.schemas.approval import ApprovalReplyRequest
from app.schemas.task import serialize_task, serialize_tasks
from app.services import workflow_service

router = APIRouter()


@router.get("/approvals")
def approvals(db: Session = Depends(get_db)) -> list[dict]:
    return serialize_tasks(task_repository.list_tasks(db, "approval", newest_first=True))


@router.post("/approvals/{approval_id}/reply")
def reply_approval(approval_id: int, body: ApprovalReplyRequest, db: Session = Depends(get_db)) -> dict:
    approval = get_task_or_404(db, approval_id, "approval", "승인 요청을 찾을 수 없습니다.")
    return serialize_task(run_in_transaction(db, workflow_service.reply_approval, approval, body.decision, body.note))
