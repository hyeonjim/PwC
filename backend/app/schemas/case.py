"""검토 건 접수·승인 상신 요청 형식."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

OptionKey = Literal["proceed", "extra_po", "shift", "cap", "swap"]


class SkuDemand(BaseModel):
    sku_id: str
    uplift_pct: float = Field(ge=0, le=1000, description="캠페인 기간 평시 수요 대비 증가율(%)")


class CaseCreateRequest(BaseModel):
    plan_id: str | None = None
    title: str | None = None
    start_date: date
    end_date: date
    skus: list[SkuDemand]
    author: str = "마케팅팀"
    demand_as_of: date | None = None
    note: str = ""


class ApprovalCreateRequest(BaseModel):
    option_key: OptionKey
    requester: str = "SCM 담당"
    note: str = ""
