"""승인 회신(모의) 요청 형식."""

from typing import Literal

from pydantic import BaseModel


class ApprovalReplyRequest(BaseModel):
    decision: Literal["approve", "reject", "conditional"]
    note: str = ""
