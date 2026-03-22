from typing import Any

from ..dependencies.operator import OperatorContext
from ..core.errors import ApiError
from ..repositories import rooms as rooms_repository
from ..services.audit import write_audit_log
from ..utils.pagination import page_payload


def list_rooms(
    *,
    q: str | None,
    campus: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    result = rooms_repository.list_rooms(q=q, campus=campus, status=status, page=page, page_size=page_size)
    return {
        "ok": True,
        "data": result["rows"],
        "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"]),
    }


def create_room(*, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    data = rooms_repository.create_room(
        name=payload["name"],
        campus=payload.get("campus", ""),
        capacity=payload.get("capacity", 0),
        status=payload.get("status", "active"),
    )
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="rooms.create",
        resource_type="room",
        resource_id=str(data.get("id", "")),
        payload={"request": payload, "result": data},
    )
    return {"ok": True, "data": data}


def update_room(*, room_id: int, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    if not payload:
        raise ApiError(422, "VALIDATION_ERROR", "at least one field is required")
    data = rooms_repository.update_room(room_id, payload)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="rooms.update",
        resource_type="room",
        resource_id=str(room_id),
        payload={"request": payload, "result": data},
    )
    return {"ok": True, "data": data}


def delete_room(*, room_id: int, ctx: OperatorContext) -> dict[str, Any]:
    data = rooms_repository.delete_room(room_id)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="rooms.delete",
        resource_type="room",
        resource_id=str(room_id),
        payload={"room_id": room_id},
    )
    return {"ok": True, "data": data}
