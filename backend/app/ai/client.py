"""Claude API 클라이언트. 키는 서버 환경변수에만 둔다."""

from functools import lru_cache

import anthropic

from app.config import get_settings


@lru_cache
def get_client() -> anthropic.Anthropic | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    # 요청 하나가 너무 오래 걸리면 예비 판단으로 넘어가도록 시간 제한을 둔다.
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key, timeout=120.0, max_retries=2
    )
