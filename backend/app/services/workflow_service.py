"""캠페인 수요·공급 검토 업무 흐름.

    접수 → 확인 → AI 판단 → 승인 상신 → 승인 회신 → 후속 처리 → 완료
              ↑______ 조건 변경(공급자 회신·수요 정정)이 들어오면 다시 확인 ______|

상태는 모두 DB(tasks, events)에 남고, 다음 확인 때 계산 엔진의 입력으로 다시 쓰인다.
  - 승인된 추가 발주      → 입고 전망과 현금 전망에 반영
  - 승인된 캠페인 수요    → 같은 SKU 를 쓰는 다른 캠페인의 재고 전망에서 차감
  - 공급자 입고예정 회신  → 입고 전망에 반영

tasks.kind
  case       캠페인 검토 건
  approval   승인 요청
  work_item  부서별 후속 작업
  po         시스템에서 만든 추가 발주
  eta_reply  공급자 입고예정 회신(모의)
"""

import json
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.service import judge
from app.db.models import Event, Task
from app.engine import campaign_case
from app.engine.supply import SupplyState, sku_table

# 검토 건 상태
RECEIVED = "received"  # 접수
INFO_NEEDED = "info_needed"  # 정보 확인 중
CHECKED = "checked"  # 확인 완료
JUDGED = "judged"  # 판단 완료
PENDING = "pending_approval"  # 승인 대기
REJECTED = "rejected"  # 승인 거절 → 대안 재검토
CONDITIONAL = "conditional"  # 조건부 승인 → 조건 반영 후 재상신
EXECUTING = "executing"  # 후속 처리 중
RECHECK = "recheck_needed"  # 조건 변경으로 재검토 필요
DONE = "done"  # 완료

BEFORE_APPROVAL = {RECEIVED, INFO_NEEDED, CHECKED, JUDGED, REJECTED, CONDITIONAL, RECHECK}
COMMITTED = {EXECUTING, DONE}


class WorkflowError(Exception):
    """업무 규칙상 할 수 없는 요청."""


# ── 공통 ────────────────────────────────────────────────────────


def _jsonable(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def log(db: Session, task_id: int | None, actor: str, action: str, note: str = "", detail: dict | None = None) -> None:
    db.add(Event(task_id=task_id, actor=actor, action=action, note=note, detail=_jsonable(detail or {})))


def _patch(task: Task, **changes: Any) -> None:
    """JSON 컬럼은 통째로 다시 넣어야 변경이 저장된다."""
    task.payload = _jsonable({**task.payload, **changes})


def _tasks(db: Session, kind: str, **payload_match: Any) -> list[Task]:
    rows = db.scalars(select(Task).where(Task.kind == kind).order_by(Task.id)).all()
    return [t for t in rows if all(t.payload.get(k) == v for k, v in payload_match.items())]


def get_case(db: Session, case_id: int) -> Task:
    task = db.get(Task, case_id)
    if task is None or task.kind != "case":
        raise WorkflowError(f"검토 건 {case_id} 을(를) 찾을 수 없습니다.")
    return task


def _work_item(db: Session, case: Task, dept: str, title: str, type_: str, **extra: Any) -> Task:
    item = Task(kind="work_item", title=title, status="open", payload=_jsonable({"case_id": case.id, "dept": dept, "type": type_, **extra}))
    db.add(item)
    db.flush()
    log(db, case.id, "system", "작업 생성", f"[{dept}] {title}", {"work_item_id": item.id})
    return item


# ── 시스템 상태 → 계산 엔진 입력 ─────────────────────────────────


def build_state(db: Session, exclude_case_id: int | None = None) -> SupplyState:
    state = SupplyState()
    for reply in _tasks(db, "eta_reply"):
        if reply.status != "active":
            continue
        eta = pd.to_datetime(reply.payload["eta"]).date()
        if reply.payload["target"] == "in_transit":
            state.in_transit_eta[reply.payload["sku_id"]] = eta
        else:
            state.po_eta_override[reply.payload["po_ref"]] = eta
    for po in _tasks(db, "po"):
        if po.status != "cancelled":
            state.extra_pos.append({**po.payload, "ref": f"PO-{po.id}"})
    for case in _tasks(db, "case"):
        if case.status in COMMITTED and case.id != exclude_case_id and case.payload.get("commit_demand", True):
            for line in case.payload["skus"]:
                state.committed_campaigns.append(
                    {
                        "case_id": case.id,
                        "sku_id": line["sku_id"],
                        "start_date": case.payload["start_date"],
                        "end_date": case.payload["end_date"],
                        "uplift_pct": line["uplift_pct"],
                    }
                )
    return state


# ── 1. 접수 ─────────────────────────────────────────────────────


def create_case(db: Session, spec: dict) -> Task:
    known = set(sku_table()["sku_id"])
    if not spec["skus"]:
        raise WorkflowError("대상 SKU 를 하나 이상 넣어 주세요.")
    for line in spec["skus"]:
        if line["sku_id"] not in known:
            raise WorkflowError(f"없는 SKU 입니다: {line['sku_id']}")
    if pd.to_datetime(spec["end_date"]) < pd.to_datetime(spec["start_date"]):
        raise WorkflowError("종료일이 시작일보다 빠릅니다.")

    plan = next((p for p in campaign_case.plans() if p["plan_id"] == spec.get("plan_id")), None)
    title = plan["campaign_name"] if plan else spec.get("title") or "캠페인 검토"
    case = Task(
        kind="case",
        title=f"{title} ({spec['start_date']}~{spec['end_date']})",
        status=RECEIVED,
        payload=_jsonable({**spec, "campaign_id": plan["campaign_id"] if plan else None, "rejected_options": [], "conditions": [], "commit_demand": True}),
    )
    db.add(case)
    db.flush()
    log(db, case.id, spec.get("author") or "마케팅팀", "접수", "캠페인 계획과 수요 가정 접수", {"skus": spec["skus"], "demand_as_of": spec.get("demand_as_of")})
    run_check(db, case)
    return case


# ── 2. 확인 ─────────────────────────────────────────────────────


def _signature(check: dict | None) -> list:
    if not check:
        return []
    return [
        check["conclusion"],
        sum(s["shortage_in_campaign_qty"] for s in check["skus"]),
        [[o["key"], o["feasible"], o["route"]["approver"]] for o in check["options"]],
    ]


def run_check(db: Session, case: Task, actor: str = "system", reason: str = "") -> dict:
    result = _jsonable(campaign_case.evaluate(case.payload, build_state(db, exclude_case_id=case.id)))
    _patch(case, check=result)

    material_gaps = [g for g in result["info_gaps"] if g["material"]]
    open_confirms = {w.payload.get("sku_id") for w in _tasks(db, "work_item", case_id=case.id, type="eta_confirm") if w.status != "done"}
    for gap in material_gaps:
        if gap["sku_id"] not in open_confirms:
            _work_item(db, case, "SCM", f"{gap['sku_id']} 이동중 물량 입고예정일 확인 요청", "eta_confirm", sku_id=gap["sku_id"])

    if case.status in {RECEIVED, INFO_NEEDED, CHECKED}:
        case.status = INFO_NEEDED if material_gaps else CHECKED

    shortage = sum(s["shortage_in_campaign_qty"] for s in result["skus"])
    note = (f"{reason} → " if reason else "") + (
        f"캠페인 기간 품절 예상 {shortage:,}개" if shortage else "캠페인 기간 품절 없음"
    )
    if material_gaps:
        note += f", 정보 공백 {len(material_gaps)}건"
    log(db, case.id, actor, "확인", note, {"conclusion": result["conclusion"], "info_gaps": result["info_gaps"]})
    return result


# ── 3. AI 판단 ──────────────────────────────────────────────────


def run_judge(db: Session, case: Task) -> dict:
    if case.status not in BEFORE_APPROVAL:
        raise WorkflowError("승인 상신 이후에는 판단을 다시 받을 수 없습니다. 조건이 바뀌면 재검토 상태가 된 뒤 다시 받으세요.")
    check = run_check(db, case)
    context = {
        "기준일": check["as_of"],
        "캠페인_계획(마케팅팀 제출 — 수요 증가율과 예상 GMV 는 부서 주장)": {
            "plan": check["plan"],
            "start_date": check["start_date"],
            "end_date": check["end_date"],
            "author": case.payload.get("author"),
            "demand_as_of": case.payload.get("demand_as_of"),
        },
        "SKU_확인_결과(계산)": [{k: v for k, v in s.items() if k != "rows"} for s in check["skus"]],
        "정보_공백": check["info_gaps"],
        "현금_전망(계산)": check["cash"],
        "대안(계산) — recommended_option 에는 이 중 하나의 key 를 적는다": check["options"],
        "이전에_거절된_대안": case.payload.get("rejected_options", []),
        "승인권자가_붙인_조건": case.payload.get("conditions", []),
    }
    result = judge(f"캠페인 검토 건 #{case.id} '{case.title}' — 어떤 대안으로 상신할지", context, prompt_name="judge_campaign_supply")
    judgment = result.model_dump()
    _patch(case, judgment=judgment)
    case.status = JUDGED
    rec = judgment["recommendation"]
    log(db, case.id, "ai" if result.source == "ai" else "rule", "판단", rec["summary"], {"decision": rec["decision"], "recommended_option": rec.get("recommended_option"), "source": result.source})
    return judgment


# ── 4. 승인 상신 ────────────────────────────────────────────────


def request_approval(db: Session, case: Task, option_key: str, requester: str, note: str = "") -> Task:
    if case.status not in BEFORE_APPROVAL:
        raise WorkflowError("이미 상신했거나 처리 중인 건입니다.")
    check = run_check(db, case)
    option = next((o for o in check["options"] if o["key"] == option_key), None)
    if option is None or not option["applicable"]:
        raise WorkflowError("지금 상태에서 고를 수 없는 대안입니다.")

    approval = Task(
        kind="approval",
        title=f"[{option['route']['approver']}] {case.title} — {option['title']}",
        status="pending",
        payload=_jsonable({"case_id": case.id, "option_key": option_key, "option": option, "approver": option["route"]["approver"], "rule": option["route"]["rule"], "requester": requester, "note": note}),
    )
    db.add(approval)
    db.flush()
    _patch(case, selected_option=option_key, approval_id=approval.id)
    case.status = PENDING
    log(db, case.id, requester, "승인 상신", f"{option['title']} → {option['route']['approver']} ({option['route']['rule']})", {"approval_id": approval.id, "feasible": option["feasible"], "note": note})
    return approval


# ── 5. 승인 회신 (모의) ─────────────────────────────────────────


def reply_approval(db: Session, approval: Task, decision: str, note: str = "") -> Task:
    if approval.kind != "approval" or approval.status != "pending":
        raise WorkflowError("대기 중인 승인 요청이 아닙니다.")
    case = get_case(db, approval.payload["case_id"])
    actor = approval.payload["approver"]
    option = approval.payload["option"]

    if decision == "approve":
        approval.status = "approved"
        log(db, case.id, actor, "승인", note or f"{option['title']} 승인", {"approval_id": approval.id, "mock": True})
        _execute(db, case, option)
        case.status = EXECUTING
        run_check(db, case, reason="승인 내용 반영")
        recheck_open_cases(db, f"검토 건 #{case.id} 승인", skip_case_id=case.id)
    elif decision == "reject":
        approval.status = "rejected"
        _patch(case, rejected_options=[*case.payload.get("rejected_options", []), {"key": option["key"], "title": option["title"], "note": note}])
        case.status = REJECTED
        log(db, case.id, actor, "거절", note or f"{option['title']} 거절", {"approval_id": approval.id, "mock": True})
        _work_item(db, case, "SCM·마케팅", f"거절된 '{option['title']}' 외 대안 재검토", "rework")
    elif decision == "conditional":
        approval.status = "conditional"
        _patch(case, conditions=[*case.payload.get("conditions", []), {"option_key": option["key"], "note": note}])
        case.status = CONDITIONAL
        log(db, case.id, actor, "조건부 승인", note, {"approval_id": approval.id, "mock": True})
        _work_item(db, case, "SCM·마케팅", f"조건 반영 후 재상신: {note}", "rework")
    else:
        raise WorkflowError("decision 은 approve / reject / conditional 중 하나입니다.")
    return approval


# ── 6. 후속 처리 ────────────────────────────────────────────────


def _execute(db: Session, case: Task, option: dict) -> None:
    """승인된 대안을 계획·작업·상태로 옮긴다. 외부 발주·통지는 보내지 않는다(모의 처리)."""
    key, details = option["key"], option["details"]
    _patch(case, commit_demand=True)

    if key == "extra_po":
        for line in details["lines"]:
            po = Task(kind="po", title=f"추가 발주 {line['sku_id']} {line['qty']:,}개", status="draft", payload=_jsonable({**line, "case_id": case.id, "eta_confirmed": False}))
            db.add(po)
            db.flush()
            log(db, case.id, "system", "발주 생성", f"PO-{po.id} {line['sku_id']} {line['qty']:,}개 {line['amount_krw']:,}원, 입고예정 {line['eta']}(가정)", {"po_id": po.id})
            _work_item(db, case, "SCM", f"PO-{po.id} 발주서 작성·전달", "po_send", po_id=po.id)
        _work_item(db, case, "재무", f"추가 발주대금 {details['total_amount_krw']:,}원 ({details['payment_due_date']} 지급) 자금계획 반영", "cash_plan")
    elif key == "shift":
        before = {"start_date": case.payload["start_date"], "end_date": case.payload["end_date"]}
        _patch(case, start_date=details["new_start_date"], end_date=details["new_end_date"], previous_schedule=before)
        log(db, case.id, "system", "캠페인 일정 변경", f"{before['start_date']}~{before['end_date']} → {details['new_start_date']}~{details['new_end_date']}", before)
        _work_item(db, case, "마케팅", "인플루언서·채널과 변경 일정 재협의", "reschedule")
        _work_item(db, case, "SCM", "변경된 캠페인 기간 입고 일정 재확인", "supply_watch")
    elif key == "cap":
        caps = {c["sku_id"]: c["max_uplift_pct"] for c in details["caps"]}
        before = case.payload["skus"]
        _patch(case, skus=[{**l, "uplift_pct": caps.get(l["sku_id"], l["uplift_pct"])} for l in before], previous_skus=before)
        log(db, case.id, "system", "캠페인 물량 변경", "수요 증가율을 수용 가능한 상한으로 조정", {"caps": details["caps"]})
        _work_item(db, case, "마케팅", "판매 수량 상한 설정 및 채널 공지", "sales_cap")
    elif key == "swap":
        _patch(case, commit_demand=False)  # 원래 SKU 수요는 약속하지 않는다
        names = ", ".join(c["sku_id"] for c in details["candidates"])
        _work_item(db, case, "마케팅", f"대체 상품({names}) 구성안 작성 후 새 검토 건으로 접수", "replan")
    else:  # proceed
        _work_item(db, case, "마케팅", "캠페인 집행 확정 통보", "campaign_confirm")
        _work_item(db, case, "SCM", "캠페인 기간 주간 재고 확인", "supply_watch")


def set_work_status(db: Session, item: Task, status: str, actor: str = "") -> Task:
    if item.kind != "work_item":
        raise WorkflowError("작업 항목이 아닙니다.")
    if status not in {"open", "in_progress", "done"}:
        raise WorkflowError("status 는 open / in_progress / done 중 하나입니다.")
    item.status = status
    case = get_case(db, item.payload["case_id"])
    log(db, case.id, actor or item.payload["dept"], "작업 상태 변경", f"{item.title} → {status}", {"work_item_id": item.id})

    if status == "done" and item.payload["type"] == "po_send":
        po = db.get(Task, item.payload["po_id"])
        po.status = "ordered"
        log(db, case.id, "system", "발주 상태 변경", f"PO-{po.id} 발주 전달 완료(모의) — 공급자 회신 대기")
        _work_item(db, case, "SCM", f"PO-{po.id} 공급자 입고예정 회신 확인", "po_eta_confirm", po_id=po.id)

    _close_if_finished(db, case)
    return item


def _close_if_finished(db: Session, case: Task) -> None:
    items = _tasks(db, "work_item", case_id=case.id)
    if case.status == EXECUTING and items and all(w.status == "done" for w in items):
        case.status = DONE
        log(db, case.id, "system", "완료", "후속 작업이 모두 끝났습니다.")


# ── 7. 조건 변경 ────────────────────────────────────────────────


def apply_change(db: Session, type_: str, data: dict, actor: str) -> dict:
    """새 사건을 반영하고, 영향을 받는 검토 건을 다시 확인한다."""
    if type_ == "in_transit_eta":
        sku_id, eta = data["sku_id"], str(data["eta"])
        for old in _tasks(db, "eta_reply", target="in_transit", sku_id=sku_id):
            old.status = "superseded"
        db.add(Task(kind="eta_reply", title=f"{sku_id} 이동중 물량 입고예정 {eta}", status="active", payload={"target": "in_transit", "sku_id": sku_id, "eta": eta, "mock": True}))
        for w in _tasks(db, "work_item", type="eta_confirm", sku_id=sku_id):
            if w.status != "done":
                w.status = "done"
                log(db, w.payload["case_id"], actor, "회신 수신", f"{sku_id} 이동중 물량 입고예정일 {eta} (모의 회신)", {"work_item_id": w.id})
        reason = f"{sku_id} 이동중 물량 입고예정일 회신 {eta}"
    elif type_ == "po_eta":
        po_ref, eta = data["po_ref"], str(data["eta"])
        for old in _tasks(db, "eta_reply", target="po", po_ref=po_ref):
            old.status = "superseded"
        db.add(Task(kind="eta_reply", title=f"{po_ref} 입고예정 {eta}", status="active", payload={"target": "po", "po_ref": po_ref, "eta": eta, "mock": True}))
        if po_ref.startswith("PO-"):
            po = db.get(Task, int(po_ref[3:]))
            if po is None or po.kind != "po":
                raise WorkflowError(f"없는 발주입니다: {po_ref}")
            _patch(po, eta=eta, eta_confirmed=True)
            po.status = "confirmed"
            for w in _tasks(db, "work_item", type="po_eta_confirm", po_id=po.id):
                w.status = "done"
            log(db, po.payload["case_id"], actor, "회신 수신", f"{po_ref} 입고예정일 {eta} (모의 회신)")
        reason = f"{po_ref} 입고예정일 회신 {eta}"
    elif type_ == "demand_revision":
        case = get_case(db, int(data["case_id"]))
        before = case.payload["skus"]
        after = [{**l, "uplift_pct": float(data["uplift_pct"])} if l["sku_id"] == data["sku_id"] else l for l in before]
        _patch(case, skus=after, demand_as_of=str(data["as_of"]))
        log(db, case.id, actor, "수요 가정 정정", f"{data['sku_id']} 증가율 → {data['uplift_pct']}%", {"before": before, "after": after})
        reason = f"검토 건 #{case.id} 수요 가정 정정"
    else:
        raise WorkflowError("type 은 in_transit_eta / po_eta / demand_revision 중 하나입니다.")

    db.flush()
    affected = recheck_open_cases(db, reason)
    for case in _tasks(db, "case"):
        _close_if_finished(db, case)
    return {"reason": reason, "rechecked": affected}


def recheck_open_cases(db: Session, reason: str, skip_case_id: int | None = None) -> list[dict]:
    """끝나지 않은 검토 건을 다시 확인하고, 결론이 달라진 건은 재검토 상태로 돌린다."""
    out = []
    for case in _tasks(db, "case"):
        if case.status == DONE or case.id == skip_case_id:
            continue
        before = _signature(case.payload.get("check"))
        run_check(db, case, reason=reason)
        after = _signature(case.payload.get("check"))
        changed = before != after
        if changed and case.status in {JUDGED, PENDING, EXECUTING}:
            if case.status == PENDING:
                approval = db.get(Task, case.payload.get("approval_id"))
                if approval and approval.status == "pending":
                    approval.status = "withdrawn"
            previous = case.status
            case.status = RECHECK
            log(db, case.id, "system", "재검토 필요", f"{reason} 으로 확인 결과가 달라졌습니다. 기존 판단·상신을 다시 봐야 합니다.", {"previous_status": previous, "before": before, "after": after})
            _work_item(db, case, "SCM", f"조건 변경 재검토: {reason}", "rework")
        out.append({"case_id": case.id, "changed": changed, "status": case.status})
    return out


def reset(db: Session) -> None:
    """시연을 처음부터 다시 하기 위해 시스템이 만든 기록을 모두 지운다. 원본 데이터는 건드리지 않는다."""
    db.query(Event).delete()
    db.query(Task).delete()
