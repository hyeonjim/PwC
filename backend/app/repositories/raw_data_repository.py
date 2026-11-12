"""원본 CSV 읽기 (읽기 전용).

- 대회 데이터의 CSV 는 쉼표가 아니라 | 로 구분된다(A05).
- 처음 요청될 때 읽고 메모리에 둔다. 앱 시작을 늦추지 않기 위해서다(AXHub 60초 제한).
- 원본 파일은 절대 수정하지 않는다. 가정·합성 데이터는 data/assumptions 에 따로 둔다.
"""

from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.core.config import get_settings


def raw_path(relative: str) -> Path:
    """원본 데이터 폴더 기준 상대 경로 → 실제 경로. 예: '02_masil/inventory/sku_inventory_ms.csv'"""
    path = (get_settings().raw_data_dir / relative).resolve()
    if get_settings().raw_data_dir.resolve() not in path.parents:
        raise ValueError(f"원본 데이터 폴더 밖의 경로입니다: {relative}")
    return path


@lru_cache(maxsize=None)
def read_table(relative: str) -> pd.DataFrame:
    """원본 CSV 를 DataFrame 으로 읽는다. 결과는 복사해서 쓰도록 호출 쪽에서 주의한다."""
    return pd.read_csv(raw_path(relative), sep="|", encoding="utf-8")

