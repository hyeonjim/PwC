"""조건 변경(공급자 회신·Corevia 생산 여력 회신·수요 정정, 모의 입력) 요청 형식."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

ChangeType = Literal["in_transit_eta", "po_eta", "capacity_reply", "demand_revision"]

# 변경 종류마다 꼭 있어야 하는 값
REQUIRED_FIELDS_BY_TYPE: dict[str, list[str]] = {
    "in_transit_eta": ["sku_id", "eta"],
    "po_eta": ["po_ref", "eta"],
    "capacity_reply": ["product_id", "available_qty"],
    "demand_revision": ["case_id", "sku_id", "uplift_pct"],
}


class ChangeRequest(BaseModel):
    type: ChangeType
    actor: str = "공급자(모의 회신)"
    sku_id: str | None = None
    po_ref: str | None = None
    eta: date | None = None
    case_id: int | None = None
    uplift_pct: float | None = None
    product_id: str | None = None  # Corevia 제품군 (PL-01 …)
    available_qty: int | None = None  # 리드타임 안에 추가로 만들 수 있는 수량
