"""Corevia 생산 여력 확인 (전문성 확장).

Masil 의 추가 발주는 Corevia 공장 라인에서 리드타임 안에 만들어야 한다.
확장 전에는 Masil 재고·현금만 보고 추가 발주를 '가능'으로 판단했다.
여기서는 SKU → Corevia 제품군(m_sku_ms.product_id) → 생산 라인(strat_capacity_cv)으로 이어
라인에 남은 여력 안에서 만들 수 있는 물량인지 확인한다.

원본에서 오는 것
- 라인별 연간 생산능력·가동률 : strat_capacity_cv (2026-06-30 스냅샷, 라인 단위 — data_dictionary)
- SKU → 제품군                : m_sku_ms.product_id
- 제품군 이름                 : m_product_cv

원본에 없어 가정으로 채운 것 (data/assumptions/assumptions.csv)
- ASM-012 capacity_qty 는 연간 생산능력(EA)이고, Masil SKU 1개 = Corevia 생산 1EA 로 본다.
          주간 여력 = capacity_qty × (1 − 가동률) ÷ 52
- ASM-013 스냅샷 가동률에는 이미 받은 주문(원본 발주 14건 포함)이 들어 있다. 시스템에서 새로 승인한 추가 발주만 여력을 더 쓴다.
- ASM-014 추가 발주 물량은 발주일부터 리드타임 안에 만든다. 쓸 수 있는 여력 = 주간 여력 × 리드타임(주)
Corevia 생산팀의 회신(모의)이 들어오면 추정값 대신 회신 수량을 쓴다.
"""

import math

from app.repositories.raw_data_repository import read_table
from app.services.supply_service import SupplyState, sku_table

CAPACITY = "01_corevia/production/strat_capacity_cv.csv"
PRODUCTS = "01_corevia/master/m_product_cv.csv"
WEEKS_PER_YEAR = 52

# 같은 라인을 두고 경쟁하는 다른 부서의 목표 (원본 문서에 있는 사실)
COMPETING_DEMAND = {
    "PL-02": "Corevia 영업의 C-201 대형 입찰(더마 1,500,000 EA)도 F1 더마 전용 라인에서만 만들 수 있습니다 (rfp_c201.md).",
}

# 확인 결과
OK = "ok"  # 여력 안
NEEDS_CONFIRMATION = "needs_confirmation"  # 추정 여력을 넘음 → Corevia 확인 전에는 발주 불가
SHORT = "short"  # Corevia 가 회신한 수량보다 많음 → 회신 수량까지만 발주


def lines() -> list[dict]:
    """Corevia 생산 라인별 여력 (추정)."""
    names = read_table(PRODUCTS).set_index("product_id")["product_name"]
    out = []
    for row in read_table(CAPACITY).to_dict("records"):
        free_annual = float(row["capacity_qty"]) * (1 - float(row["utilization_pct"]) / 100)
        out.append(
            {
                "product_id": row["product_id"],
                "product_name": names.get(row["product_id"], row["product_id"]),
                "plant_id": row["plant_id"],
                "line_id": row["line_id"],
                "capacity_qty": int(row["capacity_qty"]),
                "utilization_pct": float(row["utilization_pct"]),
                "free_weekly_qty": math.floor(free_annual / WEEKS_PER_YEAR),
                "snapshot_date": row["snapshot_date"],
            }
        )
    return out


def product_of_sku() -> dict[str, str]:
    table = sku_table()
    return dict(zip(table["sku_id"], table["product_id"]))


def committed_qty(product_id: str, state: SupplyState) -> int:
    """시스템에서 이미 승인된 추가 발주가 쓰는 여력."""
    product = product_of_sku()
    return sum(int(po["qty"]) for po in state.extra_pos if product.get(po["sku_id"]) == product_id)


def line_status(state: SupplyState) -> list[dict]:
    """공급 화면용: 라인별 여력과 이미 쓴 양."""
    return [
        {
            **line,
            "committed_qty": committed_qty(line["product_id"], state),
            "confirmed_qty": state.capacity_reply.get(line["product_id"]),
        }
        for line in lines()
    ]


def check(order_lines: list[dict], state: SupplyState) -> dict:
    """추가 발주 물량을 라인 여력과 맞춰 본다.

    order_lines: [{sku_id, qty, moq, lead_time_weeks}]
    돌려주는 allocations 는 여력 안에서 MOQ 단위로 낼 수 있는 SKU 별 수량이다.
    """
    product = product_of_sku()
    by_line = {line["product_id"]: line for line in lines()}
    groups: dict[str, list[dict]] = {}
    for order in order_lines:
        groups.setdefault(product[order["sku_id"]], []).append(order)

    results = []
    for product_id, orders in groups.items():
        line = by_line[product_id]
        window_weeks = max(int(o["lead_time_weeks"]) for o in orders)
        estimated = line["free_weekly_qty"] * window_weeks
        confirmed = state.capacity_reply.get(product_id)
        available = confirmed if confirmed is not None else estimated
        used = committed_qty(product_id, state)
        remaining = max(available - used, 0)
        required = sum(int(o["qty"]) for o in orders)

        left, allocations = remaining, {}
        for o in orders:
            qty = min(int(o["qty"]), left // int(o["moq"]) * int(o["moq"]))
            allocations[o["sku_id"]] = qty
            left -= qty

        results.append(
            {
                **line,
                "sku_ids": [o["sku_id"] for o in orders],
                "window_weeks": window_weeks,
                "estimated_qty": estimated,
                "confirmed_qty": confirmed,
                "basis": "corevia_reply" if confirmed is not None else "estimate",
                "already_committed_qty": used,
                "remaining_qty": remaining,
                "required_qty": required,
                "ok": required <= remaining,
                "allocations": allocations,
                "competing_demand": COMPETING_DEMAND.get(product_id),
            }
        )

    over = [r for r in results if not r["ok"]]
    if not over:
        status = OK
    elif any(r["basis"] == "estimate" for r in over):
        status = NEEDS_CONFIRMATION
    else:
        status = SHORT
    return {"status": status, "lines": results}


def describe(line: dict) -> str:
    """라인 하나의 확인 결과를 한 문장으로."""
    basis = "Corevia 회신" if line["basis"] == "corevia_reply" else f"가동률 {line['utilization_pct']:g}% 기준 추정"
    text = (
        f"{line['product_name']} 라인({line['plant_id']} {line['line_id']}) {line['window_weeks']}주 여력 "
        f"{line['remaining_qty']:,}개({basis}"
        + (f", 승인된 추가 발주 {line['already_committed_qty']:,}개 차감" if line["already_committed_qty"] else "")
        + f") / 필요 {line['required_qty']:,}개"
    )
    return text + (" — 여력 안" if line["ok"] else " — 여력 초과")
