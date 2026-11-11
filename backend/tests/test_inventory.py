"""재고 커버 검산. 원본 sku_inventory_ms.stock_cover_weeks 와 공식 계산식 결과가 같아야 한다."""

from app.engine.inventory import stock_cover


def test_stock_cover_matches_source_column():
    df = stock_cover()
    diff = (df["weeks_of_supply"].round(1) - df["stock_cover_weeks"]).abs()
    assert diff.max() < 0.05


def test_derma_skus_below_safety_minimum():
    df = stock_cover().set_index("sku_id")
    for sku in ["SKU-1001", "SKU-1002", "SKU-1004"]:
        assert df.loc[sku, "below_safety_min"], sku
