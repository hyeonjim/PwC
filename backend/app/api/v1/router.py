from fastapi import APIRouter

from app.api import health, ops

api_router = APIRouter()
api_router.include_router(health.router, tags=["system"])
api_router.include_router(ops.router, tags=["캠페인 수요·공급"])
