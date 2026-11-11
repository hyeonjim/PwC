"""테스트는 개발용 local.db 를 건드리지 않도록 임시 DB 를 쓴다. 앱을 불러오기 전에 주소를 바꿔 둔다."""

import os
import tempfile
from pathlib import Path

_db = Path(tempfile.mkdtemp(prefix="aurora-test-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_db.as_posix()}"
os.environ["ANTHROPIC_API_KEY"] = ""  # 테스트에서는 AI 를 부르지 않는다(규칙 기반 예비 판단)

from app.db import models  # noqa: E402,F401  (테이블 정의 등록)
from app.db.base import Base, engine  # noqa: E402

Base.metadata.create_all(engine)
