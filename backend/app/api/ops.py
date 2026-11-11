"""캠페인 수요·공급 운영 API.

조회      GET  /overview /supply /supply/{sku} /cash /plans /assumptions /events /work /approvals
검토 건   GET  /cases /cases/{id}      POST /cases
흐름      POST /cases/{id}/check | /judge | /approval
승인 회신 POST /approvals/{id}/reply           (모의 회신)
작업      POST /work/{id}/status
조건 변경 POST /changes                         (공급자 회신·수요 정정, 모의 입력)
초기화    POST /reset
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.data.assumptions import list_assumptions
from app.db.base import get_db
from app.db.models import Event, Task
from app.engine import campaign_case, cash
from app.engine.supply import project, sku_status, source_pos
from app.services import workflow
from app.services.workflow import WorkflowError

router = APIRouter()


# ── 직렬화 ──────────────────────────────────────────────────────


def _task(t: Task, slim: bool = False) -> dict:
    payload = t.payload
    if slim and t.kind == "case":
        payload = {k: v for k, v in payload.items() if k not in {"check", "judgment"}}
        check = t.payload.get("check") or {}
        payload["shortage_in_campaign_qty"] = sum(s["shortage_in_campaign_qty"] for s in check.get("skus", []))
        payload["info_gap_count"] = len([g for g in check.get("info_gaps", []) if g["material"]])
    return {
        "id": t.id,
        "kind": t.kind,
        "title": t.title,
        "status": t.status,
        "payload": payload,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


def _event(e: Event) -> dict:
    return {
        "id": e.id,
        "task_id": e.task_id,
        "actor": e.actor,
        "action": e.action,
        "note": e.note,
        "detail": e.detail,
        "created_at": e.created_at.isoformat(),
    }


def _list(db: Session, kind: str) -> list[Task]:
    return list(db.scalars(select(Task).where(Task.kind == kind).order_by(Task.id.desc())).all())


def _run(db: Session, fn, *args, **kwargs):
    """업무 규칙 위반은 400 으로 돌려주고, 성공하면 저장한다."""
    try:
        result = fn(db, *args, **kwargs)
        db.commit()
        return result
    except WorkflowError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── 조회 ────────────────────────────────────────────────────────


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    state = workflow.build_state(db)
    sim = cash.simulate(campaign_case._extra_outflows(state))
    skus = sku_status(state)
    cases = _list(db, "case")
    by_status: dict[str, int] = {}
    for c in cases:
        by_status[c.status] = by_status.get(c.status, 0) + 1
    return {
        "as_of": get_settings().as_of_date.isoformat(),
        "cases_by_status": by_status,
        "pending_approvals": [_task(a) for a in _list(db, "approval") if a.status == "pending"],
        "open_work_items": [_task(w) for w in _list(db, "work_item") if w.status != "done"],
        "cash": {
            "opening_krw": sim["opening_krw"],
            "covenant_min_krw": sim["covenant_min_krw"],
            "min_closing_krw": sim["min_closing_krw"],
            "min_date": sim["min_date"],
            "breach_windows": sim["breach_windows"],
        },
        "skus_below_safety": [s for s in skus if s["below_safety_min"]],
        "skus_above_safety": [s for s in skus if s["above_safety_max"]],
        "plans_due_soon": sorted(campaign_case.plans(), key=lambda p: p["days_to_deadline"])[:5],
        "recent_events": [_event(e) for e in db.scalars(select(Event).order_by(Event.id.desc()).limit(8)).all()],
    }


@router.get("/supply")
def supply(db: Session = Depends(get_db)) -> dict:
    state = workflow.build_state(db)
    return {
        "as_of": get_settings().as_of_date.isoformat(),
        "skus": sku_status(state),
        "source_pos": source_pos(),
        "system_pos": [_task(p) for p in _list(db, "po")],
    }


@router.get("/supply/{sku_id}")
def supply_detail(sku_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        return project(sku_id, state=workflow.build_state(db))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"없는 SKU 입니다: {sku_id}") from exc


@router.get("/cash")
def cash_view(db: Session = Depends(get_db)) -> dict:
    sim = cash.simulate(campaign_case._extra_outflows(workflow.build_state(db)))
    sim["official_forecast"] = cash.official_forecast_comparison(sim)
    return sim


@router.get("/plans")
def plans() -> list[dict]:
    return campaign_case.plans()


@router.get("/assumptions")
def assumptions() -> list[dict]:
    return list_assumptions()


@router.get("/events")
def events(case_id: int | None = None, limit: int = 200, db: Session = Depends(get_db)) -> list[dict]:
    query = select(Event).order_by(Event.id.desc()).limit(limit)
    if case_id is not None:
        query = query.where(Event.task_id == case_id)
    return [_event(e) for e in db.scalars(query).all()]


@router.get("/work")
def work(db: Session = Depends(get_db)) -> list[dict]:
    return [_task(w) for w in _list(db, "work_item")]


@router.get("/approvals")
def approvals(db: Session = Depends(get_db)) -> list[dict]:
    return [_task(a) for a in _list(db, "approval")]


# ── 검토 건 ─────────────────────────────────────────────────────


class SkuDemand(BaseModel):
    sku_id: str
    uplift_pct: float = Field(ge=0, le=1000, description="캠페인 기간 평시 수요 대비 증가율(%)")


class CaseCreate(BaseModel):
    plan_id: str | None = None
    title: str | None = None
    start_date: date
    end_date: date
    skus: list[SkuDemand]
    author: str = "마케팅팀"
    demand_as_of: date | None = None
    note: str = ""


@router.get("/cases")
def list_cases(db: Session = Depends(get_db)) -> list[dict]:
    return [_task(c, slim=True) for c in _list(db, "case")]


@router.post("/cases")
def create_case(body: CaseCreate, db: Session = Depends(get_db)) -> dict:
    spec = body.model_dump(mode="json")
    spec["demand_as_of"] = spec["demand_as_of"] or get_settings().as_of_date.isoformat()
    return _task(_run(db, workflow.create_case, spec))


def _case_or_404(db: Session, case_id: int) -> Task:
    try:
        return workflow.get_case(db, case_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/cases/{case_id}")
def case_detail(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = _case_or_404(db, case_id)
    mine = lambda kind: [_task(t) for t in _list(db, kind) if t.payload.get("case_id") == case_id]  # noqa: E731
    return {
        "case": _task(case),
        "approvals": mine("approval"),
        "work_items": mine("work_item"),
        "pos": mine("po"),
        "events": [_event(e) for e in db.scalars(select(Event).where(Event.task_id == case_id).order_by(Event.id)).all()],
    }


@router.post("/cases/{case_id}/check")
def check_case(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = _case_or_404(db, case_id)
    _run(db, workflow.run_check, case, "SCM", "수동 재확인")
    return _task(case)


@router.post("/cases/{case_id}/judge")
def judge_case(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = _case_or_404(db, case_id)
    _run(db, workflow.run_judge, case)
    return _task(case)


class ApprovalRequest(BaseModel):
    option_key: Literal["proceed", "extra_po", "shift", "cap", "swap"]
    requester: str = "SCM 담당"
    note: str = ""


@router.post("/cases/{case_id}/approval")
def request_approval(case_id: int, body: ApprovalRequest, db: Session = Depends(get_db)) -> dict:
    case = _case_or_404(db, case_id)
    return _task(_run(db, workflow.request_approval, case, body.option_key, body.requester, body.note))


class ApprovalReply(BaseModel):
    decision: Literal["approve", "reject", "conditional"]
    note: str = ""


@router.post("/approvals/{approval_id}/reply")
def reply_approval(approval_id: int, body: ApprovalReply, db: Session = Depends(get_db)) -> dict:
    approval = db.get(Task, approval_id)
    if approval is None or approval.kind != "approval":
        raise HTTPException(status_code=404, detail="승인 요청을 찾을 수 없습니다.")
    return _task(_run(db, workflow.reply_approval, approval, body.decision, body.note))


class WorkStatus(BaseModel):
    status: Literal["open", "in_progress", "done"]
    actor: str = ""


@router.post("/work/{item_id}/status")
def work_status(item_id: int, body: WorkStatus, db: Session = Depends(get_db)) -> dict:
    item = db.get(Task, item_id)
    if item is None or item.kind != "work_item":
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")
    return _task(_run(db, workflow.set_work_status, item, body.status, body.actor))


class Change(BaseModel):
    type: Literal["in_transit_eta", "po_eta", "demand_revision"]
    actor: str = "공급자(모의 회신)"
    sku_id: str | None = None
    po_ref: str | None = None
    eta: date | None = None
    case_id: int | None = None
    uplift_pct: float | None = None


@router.post("/changes")
def changes(body: Change, db: Session = Depends(get_db)) -> dict:
    data = body.model_dump(mode="json", exclude_none=True)
    required = {"in_transit_eta": ["sku_id", "eta"], "po_eta": ["po_ref", "eta"], "demand_revision": ["case_id", "sku_id", "uplift_pct"]}[body.type]
    missing = [k for k in required if k not in data]
    if missing:
        raise HTTPException(status_code=400, detail=f"빠진 값: {', '.join(missing)}")
    data["as_of"] = get_settings().as_of_date.isoformat()
    return _run(db, workflow.apply_change, body.type, data, body.actor)


@router.post("/reset")
def reset(db: Session = Depends(get_db)) -> dict:
    _run(db, workflow.reset)
    return {"status": "ok"}
