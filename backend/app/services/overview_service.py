"""홈 화면(오늘 할 일) 요약과, 시스템 상태를 반영한 현금 전망."""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import event_repository, task_repository
from app.schemas.task import serialize_events, serialize_task
from app.services import campaign_case_service, cash_service, workflow_service
from app.services.supply_service import sku_status

RECENT_EVENT_COUNT = 8
DUE_SOON_PLAN_COUNT = 5


def simulate_cash_with_system_state(db: Session) -> dict:
    """승인된 추가 발주대금까지 넣은 현금 전망."""
    state = workflow_service.build_state(db)
    return cash_service.simulate(campaign_case_service.extra_outflows(state))


def build_overview(db: Session) -> dict:
    state = workflow_service.build_state(db)
    simulation = cash_service.simulate(campaign_case_service.extra_outflows(state))
    skus = sku_status(state)
    cases_by_status: dict[str, int] = {}
    for case in task_repository.list_tasks(db, "case"):
        cases_by_status[case.status] = cases_by_status.get(case.status, 0) + 1

    pending_approvals = [approval for approval in task_repository.list_tasks(db, "approval", newest_first=True) if approval.status == "pending"]
    open_work_items = [item for item in task_repository.list_tasks(db, "work_item", newest_first=True) if item.status != "done"]
    return {
        "as_of": get_settings().as_of_date.isoformat(),
        "cases_by_status": cases_by_status,
        "pending_approvals": [serialize_task(approval) for approval in pending_approvals],
        "open_work_items": [serialize_task(item) for item in open_work_items],
        "cash": {
            "opening_krw": simulation["opening_krw"],
            "covenant_min_krw": simulation["covenant_min_krw"],
            "min_closing_krw": simulation["min_closing_krw"],
            "min_date": simulation["min_date"],
            "breach_windows": simulation["breach_windows"],
        },
        "skus_below_safety": [sku for sku in skus if sku["below_safety_min"]],
        "skus_above_safety": [sku for sku in skus if sku["above_safety_max"]],
        "plans_due_soon": sorted(campaign_case_service.plans(), key=lambda plan: plan["days_to_deadline"])[:DUE_SOON_PLAN_COUNT],
        "recent_events": serialize_events(event_repository.list_recent_events(db, RECENT_EVENT_COUNT)),
    }
