from typing import Any

from ..dependencies.operator import OperatorContext
from ..repositories import schedule_events as schedule_events_repository
from ..services.audit import write_audit_log
from ..utils.pagination import page_payload


def list_schedule_events(*, q: str | None, date: str | None, page: int, page_size: int) -> dict[str, Any]:
    result = schedule_events_repository.list_schedule_events(q=q, date=date, page=page, page_size=page_size)
    return {
        "ok": True,
        "data": result["rows"],
        "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"]),
    }


def create_schedule_event(*, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    data = schedule_events_repository.create_schedule_event(payload=payload)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="schedule.create",
        resource_type="schedule_event",
        resource_id=str(data.get("id") or ""),
        payload={"request": payload, "result": data},
    )
    return {"ok": True, "data": data}


def update_schedule_event(*, event_id: int, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    data = schedule_events_repository.update_schedule_event(event_id=event_id, payload=payload)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="schedule.update",
        resource_type="schedule_event",
        resource_id=str(event_id),
        payload={"request": payload, "result": data},
    )
    return {"ok": True, "data": data}


def delete_schedule_event(*, event_id: int, ctx: OperatorContext) -> dict[str, Any]:
    data = schedule_events_repository.delete_schedule_event(event_id)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="schedule.delete",
        resource_type="schedule_event",
        resource_id=str(event_id),
        payload={"event_id": event_id},
    )
    return {"ok": True, "data": data}
