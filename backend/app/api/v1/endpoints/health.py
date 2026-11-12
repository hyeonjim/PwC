"""시스템 상태 확인 API. 화면에서 백엔드·DB·데이터·AI 연결을 한눈에 본다."""

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.config import get_settings
from app.data.loader import list_tables
from app.db.base import engine

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    db: str
    db_engine: str
    raw_tables: int
    ai_configured: bool
    ai_model: str


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # 상태 화면에 원인만 짧게 보여 준다
        db_status = f"error: {type(exc).__name__}"

    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        db=db_status,
        db_engine=engine.dialect.name,
        raw_tables=len(list_tables()),
        ai_configured=settings.ai_configured,
        ai_model=settings.anthropic_model,
    )
