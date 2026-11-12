"""작업 상태 변경 요청 형식."""

from typing import Literal

from pydantic import BaseModel


class WorkStatusRequest(BaseModel):
    status: Literal["open", "in_progress", "done"]
    actor: str = ""
