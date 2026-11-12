"""홈 화면(오늘 할 일) 요약 API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.overview_service import build_overview

router = APIRouter()


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    return build_overview(db)
