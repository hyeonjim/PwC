"""Masil 현금 시뮬레이션 (calculation_definitions 1.2) 과 차입 약정 하회 구간.

Closing[t] = Opening[t] + 회수예정 - 지급예정 - 발주대금
- 회수예정 : fin_ar_aging_ms.outstanding_krw 를 due_date 에 배치
- 지급예정 : fin_ap_aging_ms 중 po_id = NONE 인 행만 (발주대금 이중계상 금지)
- 발주대금 : sc_purchase_orders_ms.amount_krw 를 payment_due_date 에 배치
- 하회 판정: 영업일별 일말 잔액 < 30억 (기간 평균 아님, 그룹 지원 미포함)

원본에 없는 부분은 가정으로 처리한다 (data/assumptions/assumptions.csv).
- ASM-005 기준일 이전에 기한이 지난 미수금은 회수 시점을 알 수 없어 전망에서 뺀다(보수적).
- ASM-006 기준일 이전에 기한이 지난 미지급금은 기준일에 지급한다고 본다(보수적).
- ASM-009 주말에 걸린 예정일은 다음 영업일로 옮긴다.
"""

from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.config import get_settings
from app.data.loader import read_table
from app.engine.bizcal import business_days, next_business_day, week_start

CASH_DAILY = "02_masil/financials/fin_cash_daily_ms.csv"
AR_AGING = "02_masil/financials/fin_ar_aging_ms.csv"
AP_AGING = "02_masil/financials/fin_ap_aging_ms.csv"
PURCHASE_ORDERS = "02_masil/inventory/sc_purchase_orders_ms.csv"
OFFICIAL_FORECAST = "02_masil/financials/fin_cash_forecast_ms.csv"


def _d(value: Any) -> date:
    return pd.to_datetime(value).date()


def scheduled_items() -> tuple[list[dict], list[dict]]:
    """원본 스케줄을 현금 항목으로 바꾼다. (반영 항목, 제외 항목) 을 돌려준다."""
    as_of = get_settings().as_of_date
    items: list[dict] = []
    excluded: list[dict] = []

    for row in read_table(AR_AGING).to_dict("records"):
        due = _d(row["due_date"])
        base = {
            "kind": "ar",
            "ref": row["ar_id"],
            "label": f"매출채권 회수 {row['channel_id']}",
            "original_date": due.isoformat(),
            "amount_krw": int(row["outstanding_krw"]),
            "source": f"{AR_AGING}#{row['ar_id']}",
        }
        if due < as_of:
            excluded.append({**base, "reason": "기한 경과 미수금 — 회수 시점 미확인 (ASM-005)"})
        else:
            items.append({**base, "date": next_business_day(due)})

    for row in read_table(AP_AGING).to_dict("records"):
        if row["po_id"] != "NONE":
            continue  # 발주대금은 아래 발주 표에서 한 번만 잡는다
        due = _d(row["payment_due_date"])
        overdue = due < as_of
        items.append(
            {
                "kind": "ap",
                "ref": row["ap_id"],
                "label": f"운영 매입채무 지급 {row['supplier_id']}"
                + (" (기한 경과분, 기준일 지급 가정 ASM-006)" if overdue else ""),
                "original_date": due.isoformat(),
                "date": next_business_day(as_of if overdue else due),
                "amount_krw": -int(row["amount_krw"]),
                "source": f"{AP_AGING}#{row['ap_id']}",
            }
        )

    for row in read_table(PURCHASE_ORDERS).to_dict("records"):
        due = _d(row["payment_due_date"])
        items.append(
            {
                "kind": "po",
                "ref": row["po_id"],
                "label": f"재고 발주대금 {row['sku_id']}",
                "original_date": due.isoformat(),
                "date": next_business_day(max(due, as_of)),
                "amount_krw": -int(row["amount_krw"]),
                "source": f"{PURCHASE_ORDERS}#{row['po_id']}",
            }
        )
    return items, excluded


def simulate(extra_outflows: list[dict] | None = None, horizon_days: int = 90) -> dict:
    """기준일부터 horizon_days 동안 영업일별 잔액을 계산한다.

    extra_outflows: 시스템에서 새로 생긴 현금 유출. [{date, amount_krw(양수), label, ref}]
    """
    as_of = get_settings().as_of_date
    end = as_of + timedelta(days=horizon_days)

    daily = read_table(CASH_DAILY)
    actual = daily[pd.to_datetime(daily["date"]).dt.date < as_of].iloc[-1]
    opening = int(actual["closing_balance"])
    covenant_min = int(actual["covenant_min_krw"])

    items, excluded = scheduled_items()
    for extra in extra_outflows or []:
        items.append(
            {
                "kind": "new",
                "ref": extra.get("ref", ""),
                "label": extra.get("label", "신규 약정"),
                "original_date": _d(extra["date"]).isoformat(),
                "date": next_business_day(max(_d(extra["date"]), as_of)),
                "amount_krw": -abs(int(extra["amount_krw"])),
                "source": "system",
            }
        )

    rows: list[dict] = []
    balance = opening
    for day in business_days(as_of, end):
        todays = [i for i in items if i["date"] == day]
        inflow = sum(i["amount_krw"] for i in todays if i["amount_krw"] > 0)
        outflow = -sum(i["amount_krw"] for i in todays if i["amount_krw"] < 0)
        balance = balance + inflow - outflow
        rows.append(
            {
                "date": day.isoformat(),
                "inflow_krw": inflow,
                "outflow_krw": outflow,
                "closing_krw": balance,
                "below_covenant": balance < covenant_min,
                "items": [
                    {"ref": i["ref"], "label": i["label"], "amount_krw": i["amount_krw"], "kind": i["kind"]}
                    for i in todays
                ],
            }
        )

    lowest = min(rows, key=lambda r: r["closing_krw"])
    return {
        "as_of": as_of.isoformat(),
        "horizon_end": end.isoformat(),
        "opening_krw": opening,
        "opening_source": f"{CASH_DAILY}#{actual['date']} closing_balance",
        "covenant_min_krw": covenant_min,
        "rows": rows,
        "breach_windows": _windows(rows),
        "min_closing_krw": lowest["closing_krw"],
        "min_date": lowest["date"],
        "excluded": excluded,
    }


def _windows(rows: list[dict]) -> list[dict]:
    """30억 하회가 이어지는 영업일 구간들."""
    windows: list[dict] = []
    current: dict | None = None
    for row in rows:
        if row["below_covenant"]:
            if current is None:
                current = {"start": row["date"], "end": row["date"], "min_closing_krw": row["closing_krw"]}
            current["end"] = row["date"]
            current["min_closing_krw"] = min(current["min_closing_krw"], row["closing_krw"])
        elif current is not None:
            windows.append(current)
            current = None
    if current is not None:
        windows.append({**current, "open_ended": True})
    return windows


def in_breach_window(day: date | str, windows: list[dict]) -> bool:
    day = next_business_day(_d(day))
    return any(_d(w["start"]) <= day <= _d(w["end"]) for w in windows)


def official_forecast_comparison(sim: dict) -> list[dict]:
    """재무팀 공식 전망(부서 주장)과 스케줄 합산 결과를 주 단위로 나란히 놓는다."""
    by_week: dict[date, int] = {}
    for row in sim["rows"]:
        by_week[week_start(_d(row["date"]))] = row["closing_krw"]  # 그 주 마지막 영업일 잔액

    out = []
    for row in read_table(OFFICIAL_FORECAST).to_dict("records"):
        week = _d(row["week"])
        ours = by_week.get(week)
        official = int(row["projected_closing_krw"])
        out.append(
            {
                "week": week.isoformat(),
                "official_closing_krw": official,
                "simulated_closing_krw": ours,
                "gap_krw": None if ours is None else ours - official,
            }
        )
    return out
