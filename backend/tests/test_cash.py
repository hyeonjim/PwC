"""현금 전망 검산. 계산 정의 1.2 를 그대로 따랐는지 확인한다."""

from app.services import cash_service


def test_po_payment_is_counted_once():
    sim = cash_service.simulate()
    day = next(r for r in sim["rows"] if r["date"] == "2026-07-21")
    po_out = -sum(i["amount_krw"] for i in day["items"] if i["kind"] == "po")
    assert po_out == 3_749_760_000  # 발주 14건 합계. AP 의 발주 연결분은 다시 빼지 않는다.
    assert not any(i["kind"] == "ap" for i in day["items"])


def test_breach_window_starts_when_po_payment_is_due():
    sim = cash_service.simulate()
    assert sim["opening_krw"] == 5_148_063_540
    assert sim["breach_windows"][0]["start"] == "2026-07-21"
    assert sim["min_closing_krw"] < sim["covenant_min_krw"]


def test_new_commitment_lowers_the_minimum():
    base = cash_service.simulate()
    more = cash_service.simulate([{"date": "2026-07-29", "amount_krw": 500_000_000, "label": "t", "ref": "t"}])
    assert more["min_closing_krw"] == base["min_closing_krw"] - 500_000_000
