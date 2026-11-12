"""가정·매핑 목록 API (data/assumptions)."""

from fastapi import APIRouter

from app.repositories.assumption_repository import list_assumptions

router = APIRouter()


@router.get("/assumptions")
def assumptions() -> list[dict]:
    return list_assumptions()
