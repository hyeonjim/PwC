"""참가자가 만든 가정·매핑 읽기 (data/assumptions). 원본과 섞이지 않게 따로 읽는다."""

from functools import lru_cache

import pandas as pd

from app.config import get_settings


@lru_cache
def list_assumptions() -> list[dict]:
    path = get_settings().assumptions_dir / "assumptions.csv"
    if not path.is_file():
        return []
    return pd.read_csv(path, sep="|", encoding="utf-8", dtype=str).fillna("").to_dict("records")
