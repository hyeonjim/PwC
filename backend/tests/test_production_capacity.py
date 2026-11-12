"""전문성 확장 시험: Corevia 생산 여력이 추가 발주의 판단·상신·후속 작업을 바꾸는지."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# 더마 SKU-1002, 9월 캠페인. Masil 재고만 보면 추가 발주 24,000개로 품절을 막을 수 있다.
DERMA_SEPTEMBER = {"start_date": "2026-09-21", "end_date": "2026-10-11", "skus": [{"sku_id": "SKU-1002", "uplift_pct": 40}]}
DERMA_SEPTEMBER_OTHER = {"start_date": "2026-09-21", "end_date": "2026-10-11", "skus": [{"sku_id": "SKU-1001", "uplift_pct": 40}]}


@pytest.fixture(autouse=True)
def clean():
    client.post("/api/v1/reset")
    yield
    client.post("/api/v1/reset")


def _detail(case_id):
    return client.get(f"/api/v1/cases/{case_id}").json()


def _extra_po(case):
    return next(o for o in case["payload"]["check"]["options"] if o["key"] == "extra_po")


def _capacity_reply(qty):
    return client.post("/api/v1/changes", json={"type": "capacity_reply", "product_id": "PL-02", "available_qty": qty, "actor": "Corevia 생산계획팀"})


def test_capacity_changes_extra_po_judgment():
    case = client.post("/api/v1/cases", json=DERMA_SEPTEMBER).json()
    option = _extra_po(case)

    # 확장 전 판단: 가능 / 확장 후: 더마 라인(가동률 97%) 12주 여력 13,488개 < 24,000개 → 확인 필요
    assert option["details"]["without_capacity_check"]["feasible"]
    assert not option["feasible"]
    assert option["details"]["capacity"]["status"] == "needs_confirmation"
    line = option["details"]["capacity"]["lines"][0]
    assert (line["line_id"], line["remaining_qty"], line["required_qty"]) == ("L-02", 13488, 24000)
    assert line["competing_demand"]  # C-201 입찰과 같은 라인

    # 정보 공백 → Corevia 생산팀 확인 작업, 검토 건은 정보 확인 중
    assert case["status"] == "info_needed"
    work = _detail(case["id"])["work_items"]
    assert any(w["payload"]["type"] == "capacity_confirm" and w["payload"]["dept"] == "Corevia 생산" for w in work)

    # 확인 전에는 추가 발주를 상신할 수 없다
    res = client.post(f"/api/v1/cases/{case['id']}/approval", json={"option_key": "extra_po"})
    assert res.status_code == 400
    assert "Corevia" in res.json()["detail"]


def test_corevia_reply_allows_po_and_creates_production_work():
    case = client.post("/api/v1/cases", json=DERMA_SEPTEMBER).json()
    _capacity_reply(30000)

    detail = _detail(case["id"])
    assert detail["case"]["status"] == "checked"
    assert _extra_po(detail["case"])["feasible"]
    assert all(w["status"] == "done" for w in detail["work_items"] if w["payload"]["type"] == "capacity_confirm")

    approval = client.post(f"/api/v1/cases/{case['id']}/approval", json={"option_key": "extra_po"}).json()
    client.post(f"/api/v1/approvals/{approval['id']}/reply", json={"decision": "approve"})
    work = _detail(case["id"])["work_items"]
    assert any(w["payload"]["type"] == "production_schedule" for w in work)

    # 승인된 발주가 라인 여력을 쓴다
    line = next(l for l in client.get("/api/v1/supply").json()["production_lines"] if l["product_id"] == "PL-02")
    assert line["committed_qty"] == 24000


def test_approved_po_reduces_capacity_for_next_case():
    first = client.post("/api/v1/cases", json=DERMA_SEPTEMBER).json()
    _capacity_reply(30000)
    approval = client.post(f"/api/v1/cases/{first['id']}/approval", json={"option_key": "extra_po"}).json()
    client.post(f"/api/v1/approvals/{approval['id']}/reply", json={"decision": "approve"})

    # 같은 더마 라인을 쓰는 다음 건: 남은 6,000개로는 MOQ 24,000개 발주를 낼 수 없다
    second = client.post("/api/v1/cases", json=DERMA_SEPTEMBER_OTHER).json()
    option = _extra_po(second)
    assert option["details"]["capacity"]["status"] == "short"
    assert option["details"]["capacity"]["lines"][0]["remaining_qty"] == 6000
    assert not option["feasible"]
    assert client.post(f"/api/v1/cases/{second['id']}/approval", json={"option_key": "extra_po"}).status_code == 400


def test_lower_corevia_reply_reopens_pending_approval():
    case = client.post("/api/v1/cases", json=DERMA_SEPTEMBER).json()
    _capacity_reply(30000)
    approval = client.post(f"/api/v1/cases/{case['id']}/approval", json={"option_key": "extra_po"}).json()

    # Corevia 가 회신을 정정: C-201 입찰 대응으로 10,000개만 가능
    _capacity_reply(10000)
    detail = _detail(case["id"])
    assert detail["case"]["status"] == "recheck_needed"
    assert next(a for a in detail["approvals"] if a["id"] == approval["id"])["status"] == "withdrawn"
    assert not _extra_po(detail["case"])["feasible"]
