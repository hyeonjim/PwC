"""현금 전망·약정 API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import cash_service
from app.services.overview_service import simulate_cash_with_system_state

router = APIRouter()


@router.get("/cash")
def cash(db: Session = Depends(get_db)) -> dict:
    simulation = simulate_cash_with_system_state(db)
    simulation["official_forecast"] = cash_service.official_forecast_comparison(simulation)
    return simulation
