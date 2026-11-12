"""조건 변경 API (공급자 회신·수요 정정, 모의 입력)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.endpoint_helpers import run_in_transaction
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.change import REQUIRED_FIELDS_BY_TYPE, ChangeRequest
from app.services import workflow_service

router = APIRouter()


@router.post("/changes")
def apply_change(body: ChangeRequest, db: Session = Depends(get_db)) -> dict:
    data = body.model_dump(mode="json", exclude_none=True)
    missing = [field for field in REQUIRED_FIELDS_BY_TYPE[body.type] if field not in data]
    if missing:
        raise HTTPException(status_code=400, detail="빠진 값: " + ", ".join(missing))
    data["as_of"] = get_settings().as_of_date.isoformat()
    return run_in_transaction(db, workflow_service.apply_change, body.type, data, body.actor)
