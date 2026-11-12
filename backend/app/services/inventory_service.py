"""재고 커버 (calculation_definitions 1.3).

Weeks of Supply = available_qty / 최근 4주 평균 주간판매량
- available_qty = on_hand_qty (원본에 예약수량이 없음)
- in_transit_qty 는 커버 계산에 넣지 않는다.
"""

import pandas as pd

from app.data.loader import read_table

INVENTORY = "02_masil/inventory/sku_inventory_ms.csv"
WEEKLY_SALES = "02_masil/inventory/sku_weekly_sales_ms.csv"
SKU_MASTER = "02_masil/master/m_sku_ms.csv"


def trailing_4w_avg_demand() -> pd.Series:
    sales = read_table(WEEKLY_SALES).copy()
    sales["week"] = pd.to_datetime(sales["week"])
    last_week = sales["week"].max()
    recent = sales[sales["week"] > last_week - pd.Timedelta(weeks=4)]
    return recent.groupby("sku_id")["sold_qty"].mean()


def stock_cover() -> pd.DataFrame:
    """SKU 별 재고 커버(주)와 최소 안전재고 대비 부족 여부."""
    inv = read_table(INVENTORY).copy()
    sku = read_table(SKU_MASTER)[
        ["sku_id", "sku_name", "category", "safety_stock_weeks_min", "lead_time_weeks", "moq"]
    ]
    demand = trailing_4w_avg_demand()

    df = inv.merge(sku, on="sku_id", how="left")
    df["avg_weekly_demand_4w"] = df["sku_id"].map(demand)
    df["weeks_of_supply"] = df["on_hand_qty"] / df["avg_weekly_demand_4w"]
    df["below_safety_min"] = df["weeks_of_supply"] < df["safety_stock_weeks_min"]
    return df
