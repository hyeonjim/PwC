"""앱 설정. 환경변수(.env 포함)에서 읽는다.

로컬과 AXHub 의 차이는 여기서만 흡수한다.
- DATABASE_URL 이 없으면 로컬 SQLite 파일을 쓴다.
- AXHub 는 DATABASE_URL·DIRECT_DATABASE_URL·PORT 를 자동으로 넣어 준다.
"""

from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
REPO_ROOT = BACKEND_DIR.parent


def _to_psycopg(url: str) -> str:
    """postgres:// 형식 주소를 SQLAlchemy + psycopg3 형식으로 바꾼다."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # 가상기업 기준일(문제 속 "오늘"). 실제 날짜가 아니라 이 날짜로 판단한다(A05 2항).
    as_of_date: date = date(2026, 7, 1)

    # DB
    database_url: str = ""
    direct_database_url: str = ""

    # 데이터 위치 (원본은 읽기 전용, 가정·합성 데이터는 별도 폴더)
    raw_data_dir: Path = REPO_ROOT / "01_참가자_배포용" / "04_원본데이터"
    assumptions_dir: Path = REPO_ROOT / "data" / "assumptions"

    # Next.js 정적 내보내기 결과
    static_dir: Path = REPO_ROOT / "frontend" / "out"

    # AI
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    ai_effort: str = "high"

    # 개발 중에만 쓰는 화면 주소 허용 (쉼표로 구분)
    cors_origins: str = ""

    @property
    def db_url(self) -> str:
        if self.database_url:
            return _to_psycopg(self.database_url)
        return f"sqlite:///{(BACKEND_DIR / 'local.db').as_posix()}"

    @property
    def migration_db_url(self) -> str:
        """마이그레이션은 중계기를 거치지 않는 직접 연결 주소를 쓴다(AXHub 문서 4-1)."""
        if self.direct_database_url:
            return _to_psycopg(self.direct_database_url)
        return self.db_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
