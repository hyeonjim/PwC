"""FastAPI 진입점.

- /healthz : AXHub 상태 확인용. DB·AI 를 부르지 않고 바로 응답한다.
- /api/v1/... : 백엔드 API
- /docs    : 자동 API 문서
- /        : Next.js 정적 화면 (frontend/out 이 있을 때)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title="Aurora 운영 시스템 API", version="0.1.0")

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/healthz", include_in_schema=False, response_class=PlainTextResponse)
def healthz() -> str:
    return "ok"


app.include_router(api_router, prefix="/api/v1")

# 화면 파일은 맨 마지막에 연결한다. 위 경로들이 먼저 처리된다.
if settings.static_dir.is_dir():
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
