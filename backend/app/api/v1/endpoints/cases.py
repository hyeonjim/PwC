"""캠페인 검토 건 API: 접수, 조회, 확인, AI 판단, 승인 상신."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.endpoint_helpers import get_case_or_404, run_in_transaction
from app.core.config import get_settings
from app.db.session import get_db
from app.repositories import event_repository, task_repository
from app.schemas.case import ApprovalCreateRequest, CaseCreateRequest
from app.schemas.task import serialize_events, serialize_task
from app.services import workflow_service

router = APIRouter()


@router.get("/cases")
def list_cases(db: Session = Depends(get_db)) -> list[dict]:
    return [serialize_task(case, summary_only=True) for case in task_repository.list_tasks(db, "case", newest_first=True)]


@router.post("/cases")
def create_case(body: CaseCreateRequest, db: Session = Depends(get_db)) -> dict:
    spec = body.model_dump(mode="json")
    spec["demand_as_of"] = spec["demand_as_of"] or get_settings().as_of_date.isoformat()
    return serialize_task(run_in_transaction(db, workflow_service.create_case, spec))


@router.get("/cases/{case_id}")
def case_detail(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = get_case_or_404(db, case_id)

    def related(kind: str) -> list[dict]:
        return [serialize_task(task) for task in task_repository.list_tasks(db, kind, newest_first=True, case_id=case_id)]

    return {
        "case": serialize_task(case),
        "approvals": related("approval"),
        "work_items": related("work_item"),
        "pos": related("po"),
        "events": serialize_events(event_repository.list_events_of_task(db, case_id)),
    }


@router.post("/cases/{case_id}/check")
def check_case(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = get_case_or_404(db, case_id)
    run_in_transaction(db, workflow_service.run_check, case, "SCM", "수동 재확인")
    return serialize_task(case)


@router.post("/cases/{case_id}/judge")
def judge_case(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = get_case_or_404(db, case_id)
    run_in_transaction(db, workflow_service.run_judge, case)
    return serialize_task(case)


@router.post("/cases/{case_id}/approval")
def request_approval(case_id: int, body: ApprovalCreateRequest, db: Session = Depends(get_db)) -> dict:
    case = get_case_or_404(db, case_id)
    approval = run_in_transaction(db, workflow_service.request_approval, case, body.option_key, body.requester, body.note)
    return serialize_task(approval)
