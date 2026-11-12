"""시연 초기화 API. 시스템이 만든 기록만 지우고 원본·가정 파일은 그대로 둔다."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.endpoint_helpers import run_in_transaction
from app.db.session import get_db
from app.services import workflow_service

router = APIRouter()


@router.post("/reset")
def reset(db: Session = Depends(get_db)) -> dict:
    run_in_transaction(db, workflow_service.reset)
    return {"status": "ok"}
