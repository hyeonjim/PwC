from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_is_plain_ok():
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.text == "ok"


def test_api_health_reports_data_tables():
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["raw_tables"] == 50  # 원본 CSV 50개가 모두 보이는지
    assert body["db"] == "ok"
