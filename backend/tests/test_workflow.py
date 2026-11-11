"""업무 흐름 시험: 접수 → 확인 → 상신 → 회신 → 후속 처리, 그리고 조건 변경."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DERMA = {"plan_id": "PLAN-011", "start_date": "2026-07-20", "end_date": "2026-08-16", "skus": [{"sku_id": "SKU-1001", "uplift_pct": 40}]}
COLOR = {"plan_id": "PLAN-002", "start_date": "2026-07-20", "end_date": "2026-08-16", "skus": [{"sku_id": "SKU-3002", "uplift_pct": 40}]}


@pytest.fixture(autouse=True)
def clean():
    client.post("/api/reset")
    yield
    client.post("/api/reset")


def _option(case, key):
    return next(o for o in case["payload"]["check"]["options"] if o["key"] == key)


def test_normal_case_runs_to_done():
    case = client.post("/api/cases", json=COLOR).json()
    assert case["status"] == "checked"
    assert _option(case, "proceed")["feasible"]
    # 집행 예정일(8/6)이 30억 하회 예상 구간이라 평시 전결이 아니라 그룹 CEO 로 간다.
    assert _option(case, "proceed")["route"]["approver"] == "그룹 CEO"

    approval = client.post(f"/api/cases/{case['id']}/approval", json={"option_key": "proceed"}).json()
    client.post(f"/api/approvals/{approval['id']}/reply", json={"decision": "approve"})
    detail = client.get(f"/api/cases/{case['id']}").json()
    assert detail["case"]["status"] == "executing"
    assert len(detail["work_items"]) == 2

    for item in detail["work_items"]:
        client.post(f"/api/work/{item['id']}/status", json={"status": "done"})
    assert client.get(f"/api/cases/{case['id']}").json()["case"]["status"] == "done"

    # 승인된 캠페인 수요는 공급 현황에 약속으로 남는다.
    sku = next(s for s in client.get("/api/supply").json()["skus"] if s["sku_id"] == "SKU-3002")
    assert sku["committed_campaigns"][0]["case_id"] == case["id"]


def test_info_gap_then_supplier_reply():
    case = client.post("/api/cases", json=DERMA).json()
    assert case["status"] == "info_needed"
    assert not _option(case, "proceed")["feasible"]
    assert _option(case, "extra_po")["route"]["approver"] == "그룹 CEO"

    res = client.post("/api/changes", json={"type": "in_transit_eta", "sku_id": "SKU-1001", "eta": "2026-07-10"}).json()
    assert res["rechecked"][0]["case_id"] == case["id"]
    detail = client.get(f"/api/cases/{case['id']}").json()
    assert detail["case"]["status"] == "checked"
    assert all(w["status"] == "done" for w in detail["work_items"] if w["payload"]["type"] == "eta_confirm")


def test_rejection_leads_to_rework():
    case = client.post("/api/cases", json=DERMA).json()
    approval = client.post(f"/api/cases/{case['id']}/approval", json={"option_key": "extra_po"}).json()
    client.post(f"/api/approvals/{approval['id']}/reply", json={"decision": "reject", "note": "하회 구간 신규 약정 불가"})
    detail = client.get(f"/api/cases/{case['id']}").json()
    assert detail["case"]["status"] == "rejected"
    assert detail["case"]["payload"]["rejected_options"][0]["key"] == "extra_po"
    assert any(w["payload"]["type"] == "rework" for w in detail["work_items"])
    # 거절 뒤 다른 대안으로 다시 올릴 수 있다.
    again = client.post(f"/api/cases/{case['id']}/approval", json={"option_key": "swap"})
    assert again.status_code == 200


def test_demand_change_reopens_pending_approval():
    case = client.post("/api/cases", json=COLOR).json()
    approval = client.post(f"/api/cases/{case['id']}/approval", json={"option_key": "proceed"}).json()
    client.post("/api/changes", json={"type": "demand_revision", "case_id": case["id"], "sku_id": "SKU-3002", "uplift_pct": 900, "actor": "마케팅팀"})
    detail = client.get(f"/api/cases/{case['id']}").json()
    assert detail["case"]["status"] == "recheck_needed"
    assert next(a for a in detail["approvals"] if a["id"] == approval["id"])["status"] == "withdrawn"
