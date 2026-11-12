"""tasks·events 를 API 응답(dict)으로 바꾼다. 프론트엔드 src/types 와 형식을 맞춘다."""

from app.models import Event, Task

# 목록 화면에서는 무거운 계산 결과를 빼고 요약 숫자만 보낸다.
_HEAVY_CASE_FIELDS = {"check", "judgment"}


def serialize_task(task: Task, summary_only: bool = False) -> dict:
    payload = task.payload
    if summary_only and task.kind == "case":
        payload = {key: value for key, value in payload.items() if key not in _HEAVY_CASE_FIELDS}
        check = task.payload.get("check") or {}
        payload["shortage_in_campaign_qty"] = sum(sku["shortage_in_campaign_qty"] for sku in check.get("skus", []))
        payload["info_gap_count"] = len([gap for gap in check.get("info_gaps", []) if gap["material"]])
    return {
        "id": task.id,
        "kind": task.kind,
        "title": task.title,
        "status": task.status,
        "payload": payload,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }


def serialize_tasks(tasks: list[Task]) -> list[dict]:
    return [serialize_task(task) for task in tasks]


def serialize_event(event: Event) -> dict:
    return {
        "id": event.id,
        "task_id": event.task_id,
        "actor": event.actor,
        "action": event.action,
        "note": event.note,
        "detail": event.detail,
        "created_at": event.created_at.isoformat(),
    }


def serialize_events(events: list[Event]) -> list[dict]:
    return [serialize_event(event) for event in events]
