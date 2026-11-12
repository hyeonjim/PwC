"""SKU 수요·공급 API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.repositories import task_repository
from app.schemas.task import serialize_tasks
from app.services import production_capacity_service, workflow_service
from app.services.supply_service import project, sku_status, source_pos

router = APIRouter()


@router.get("/supply")
def supply(db: Session = Depends(get_db)) -> dict:
    state = workflow_service.build_state(db)
    return {
        "as_of": get_settings().as_of_date.isoformat(),
        "skus": sku_status(state),
        "source_pos": source_pos(),
        "system_pos": serialize_tasks(task_repository.list_tasks(db, "po", newest_first=True)),
        "production_lines": production_capacity_service.line_status(state),
    }


@router.get("/supply/{sku_id}")
def supply_detail(sku_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        return project(sku_id, state=workflow_service.build_state(db))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"없는 SKU 입니다: {sku_id}") from exc
