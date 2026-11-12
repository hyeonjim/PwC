"""SKU 주간 수요·공급 전망.

주 단위로 재고를 굴린다.
  기말재고 = 기초재고 + 입고 - 평시 수요 - 캠페인 추가 수요   (모자라면 품절, 재고 0)

원본에서 오는 것
- 현재고·이동중 수량 : sku_inventory_ms (2026-06-30 스냅샷)
- 평시 수요         : sku_weekly_sales_ms 최근 4주 평균 (calculation_definitions 1.3)
- 발주              : sc_purchase_orders_ms
- MOQ·리드타임·안전재고 : m_sku_ms

원본에 없어 가정으로 채운 것 (data/assumptions/assumptions.csv)
- ASM-001 발주 입고예정일 = 발주일 + 리드타임(주). 원본에 입고예정일 컬럼이 없다.
- ASM-002 이동중 수량은 입고일을 알 수 없어, 공급자 회신을 받기 전에는 전망에 넣지 않는다.
- ASM-003 캠페인 추가 수요 = 평시 수요 × 증가율(%). 증가율은 마케팅팀이 낸 값(부서 주장)이다.
- ASM-010 기준일 이후의 정기 발주는 원본에 없어 전망에 넣지 않는다.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.config import get_settings
from app.repositories.raw_data_repository import read_table
from app.core.business_calendar import week_start
from app.services.inventory_service import INVENTORY, SKU_MASTER, trailing_4w_avg_demand

PURCHASE_ORDERS = "02_masil/inventory/sc_purchase_orders_ms.csv"
DEFAULT_WEEKS = 16


def _d(value: Any) -> date:
    return value if isinstance(value, date) and not isinstance(value, pd.Timestamp) else pd.to_datetime(value).date()


@dataclass
class SupplyState:
    """시스템 안에서 쌓인 상태. DB 에서 읽어 계산 엔진에 넘긴다."""

    in_transit_eta: dict[str, date] = field(default_factory=dict)  # sku_id → 입고예정일 (공급자 회신)
    po_eta_override: dict[str, date] = field(default_factory=dict)  # 발주번호 → 바뀐 입고예정일
    extra_pos: list[dict] = field(default_factory=list)  # 시스템에서 승인된 추가 발주
    committed_campaigns: list[dict] = field(default_factory=list)  # 승인된 캠페인 수요 약속
    capacity_reply: dict[str, int] = field(default_factory=dict)  # Corevia 제품군 → 회신받은 추가 생산 가능 수량


def sku_table() -> pd.DataFrame:
    sku = read_table(SKU_MASTER)
    inv = read_table(INVENTORY)
    df = sku.merge(inv, on="sku_id", how="left")
    df["avg_weekly_demand_4w"] = df["sku_id"].map(trailing_4w_avg_demand())
    return df


def source_pos() -> list[dict]:
    """원본 발주. 입고예정일은 ASM-001 로 계산한 값이다."""
    out = []
    for row in read_table(PURCHASE_ORDERS).to_dict("records"):
        order_date = _d(row["order_date"])
        out.append(
            {
                "po_id": row["po_id"],
                "sku_id": row["sku_id"],
                "order_date": order_date.isoformat(),
                "qty": int(row["order_qty"]),
                "eta": (order_date + timedelta(weeks=int(row["lead_time_weeks"]))).isoformat(),
                "eta_basis": "ASM-001 발주일+리드타임",
                "amount_krw": int(row["amount_krw"]),
                "unit_cost_krw": int(row["amount_krw"]) // int(row["order_qty"]),
                "payment_due_date": _d(row["payment_due_date"]).isoformat(),
                "origin": "source",
            }
        )
    return out


def inbound_for(sku_id: str, state: SupplyState) -> list[dict]:
    """이 SKU 로 들어올 물량 목록. 입고일을 모르는 이동중 수량은 eta=None 으로 남긴다."""
    inbound: list[dict] = []
    for po in source_pos():
        if po["sku_id"] != sku_id:
            continue
        override = state.po_eta_override.get(po["po_id"])
        inbound.append(
            {
                "ref": po["po_id"],
                "qty": po["qty"],
                "eta": (override or _d(po["eta"])).isoformat(),
                "basis": "공급자 회신(모의)" if override else po["eta_basis"],
                "origin": "source",
            }
        )
    for po in state.extra_pos:
        if po["sku_id"] != sku_id:
            continue
        override = state.po_eta_override.get(po["ref"])
        inbound.append(
            {
                "ref": po["ref"],
                "qty": po["qty"],
                "eta": (override or _d(po["eta"])).isoformat(),
                "basis": "공급자 회신(모의)" if override or po.get("eta_confirmed") else "ASM-001 발주일+리드타임",
                "origin": "system",
            }
        )

    row = sku_table().set_index("sku_id").loc[sku_id]
    if int(row["in_transit_qty"]) > 0:
        eta = state.in_transit_eta.get(sku_id)
        inbound.append(
            {
                "ref": f"이동중-{sku_id}",
                "qty": int(row["in_transit_qty"]),
                "eta": eta.isoformat() if eta else None,
                "basis": "공급자 회신(모의)" if eta else "입고일 미확인 — 전망 제외 (ASM-002)",
                "origin": "source",
            }
        )
    return inbound


def _campaign_qty(week: date, baseline: float, campaigns: list[dict]) -> float:
    """그 주에 캠페인으로 더 팔릴 수량. 캠페인 기간과 겹치는 날짜 수만큼만 잡는다."""
    week_end = week + timedelta(days=6)
    total = 0.0
    for c in campaigns:
        start, end = _d(c["start_date"]), _d(c["end_date"])
        overlap = (min(week_end, end) - max(week, start)).days + 1
        if overlap > 0:
            total += baseline * float(c["uplift_pct"]) / 100.0 * overlap / 7.0
    return total


def project(
    sku_id: str,
    campaigns: list[dict] | None = None,
    state: SupplyState | None = None,
    weeks: int = DEFAULT_WEEKS,
    include_committed: bool = True,
) -> dict:
    """SKU 하나의 주간 전망.

    campaigns: 이번에 검토하는 캠페인 수요 [{start_date, end_date, uplift_pct}]
    state.committed_campaigns 중 같은 SKU 건은 include_committed 가 참이면 함께 차감한다.
    """
    state = state or SupplyState()
    row = sku_table().set_index("sku_id").loc[sku_id]
    baseline = float(row["avg_weekly_demand_4w"])
    safety_min = float(row["safety_stock_weeks_min"])

    demand_campaigns = list(campaigns or [])
    if include_committed:
        demand_campaigns += [c for c in state.committed_campaigns if c["sku_id"] == sku_id]

    inbound = inbound_for(sku_id, state)
    first_week = week_start(get_settings().as_of_date)

    rows: list[dict] = []
    stock = float(row["on_hand_qty"])
    for i in range(weeks):
        week = first_week + timedelta(weeks=i)
        arriving = [
            x
            for x in inbound
            if x["eta"] and (week_start(_d(x["eta"])) == week or (i == 0 and _d(x["eta"]) < week))
        ]
        inbound_qty = sum(x["qty"] for x in arriving)
        campaign_qty = _campaign_qty(week, baseline, demand_campaigns)
        available = stock + inbound_qty
        demand = baseline + campaign_qty
        shortage = max(demand - available, 0.0)
        closing = max(available - demand, 0.0)
        cover = closing / baseline if baseline else None
        rows.append(
            {
                "week": week.isoformat(),
                "opening_qty": round(stock),
                "inbound_qty": inbound_qty,
                "inbound_refs": [x["ref"] for x in arriving],
                "baseline_qty": round(baseline),
                "campaign_qty": round(campaign_qty),
                "closing_qty": round(closing),
                "shortage_qty": round(shortage),
                "cover_weeks": None if cover is None else round(cover, 1),
                "flag": "stockout" if shortage > 0 else ("below_safety" if cover is not None and cover < safety_min else "ok"),
            }
        )
        stock = closing

    first_stockout = next((r["week"] for r in rows if r["flag"] == "stockout"), None)
    first_below = next((r["week"] for r in rows if r["flag"] != "ok"), None)
    return {
        "sku_id": sku_id,
        "weeks": weeks,
        "rows": rows,
        "inbound": inbound,
        "first_stockout_week": first_stockout,
        "first_below_safety_week": first_below,
        "total_shortage_qty": sum(r["shortage_qty"] for r in rows),
    }


def shortage_between(projection: dict, start: date | str, end: date | str) -> int:
    """기간과 겹치는 주들의 품절 수량 합."""
    start, end = _d(start), _d(end)
    total = 0
    for r in projection["rows"]:
        week = _d(r["week"])
        if week <= end and week + timedelta(days=6) >= start:
            total += r["shortage_qty"]
    return total


def sku_status(state: SupplyState | None = None) -> list[dict]:
    """전체 SKU 의 현재 공급 상태 요약."""
    state = state or SupplyState()
    out = []
    for row in sku_table().to_dict("records"):
        baseline = float(row["avg_weekly_demand_4w"])
        proj = project(row["sku_id"], state=state)
        cover = float(row["on_hand_qty"]) / baseline if baseline else None
        out.append(
            {
                "sku_id": row["sku_id"],
                "sku_name": row["sku_name"],
                "category": row["category"],
                "source_company": row["source_company"],
                "on_hand_qty": int(row["on_hand_qty"]),
                "in_transit_qty": int(row["in_transit_qty"]),
                "in_transit_eta": state.in_transit_eta[row["sku_id"]].isoformat()
                if row["sku_id"] in state.in_transit_eta
                else None,
                "avg_weekly_demand_4w": round(baseline),
                "cover_weeks": None if cover is None else round(cover, 1),
                "safety_stock_weeks_min": int(row["safety_stock_weeks_min"]),
                "safety_stock_weeks_max": int(row["safety_stock_weeks_max"]),
                "moq": int(row["moq"]),
                "lead_time_weeks": int(row["lead_time_weeks"]),
                "below_safety_min": cover is not None and cover < float(row["safety_stock_weeks_min"]),
                "above_safety_max": cover is not None and cover > float(row["safety_stock_weeks_max"]),
                "first_stockout_week": proj["first_stockout_week"],
                "inbound": proj["inbound"],
                "committed_campaigns": [c for c in state.committed_campaigns if c["sku_id"] == row["sku_id"]],
            }
        )
    return out
