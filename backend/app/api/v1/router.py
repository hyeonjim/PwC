"""v1 엔드포인트를 묶는다. main.py 에서 /api/v1 아래에 연결한다."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    approvals,
    assumptions,
    cases,
    cash,
    changes,
    events,
    overview,
    plans,
    reset,
    supply,
    work,
)

api_router = APIRouter()
api_router.include_router(overview.router, tags=["오늘 할 일"])
api_router.include_router(cases.router, tags=["캠페인 검토"])
api_router.include_router(approvals.router, tags=["승인"])
api_router.include_router(work.router, tags=["작업"])
api_router.include_router(changes.router, tags=["조건 변경"])
api_router.include_router(supply.router, tags=["SKU 수요·공급"])
api_router.include_router(cash.router, tags=["현금·약정"])
api_router.include_router(plans.router, tags=["원본·가정"])
api_router.include_router(assumptions.router, tags=["원본·가정"])
api_router.include_router(events.router, tags=["처리 이력"])
api_router.include_router(reset.router, tags=["시스템"])
