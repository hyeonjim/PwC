"""캠페인 확대 기안 목록 API (원본 데이터)."""

from fastapi import APIRouter

from app.services import campaign_case_service

router = APIRouter()


@router.get("/plans")
def plans() -> list[dict]:
    return campaign_case_service.plans()
