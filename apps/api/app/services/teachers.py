from typing import Any

from ..core.errors import ApiError
from ..dependencies.operator import OperatorContext
from ..repositories import teachers as teachers_repository
from ..services.audit import write_audit_log
from ..utils.pagination import page_payload
from ..utils.teachers import generate_teacher_id, normalize_subjects, normalize_teacher_status


def list_teachers(
    *,
    q: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    normalized_status = normalize_teacher_status(status) if status else None
    result = teachers_repository.list_teachers(q=q, status=normalized_status, page=page, page_size=page_size)
    return {
        "ok": True,
        "data": result["rows"],
        "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"]),
    }


def create_teacher(*, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    source_teacher_id = (payload.get("source_teacher_id") or "").strip() or generate_teacher_id()
    subjects = normalize_subjects(payload.get("subjects"))
    status = normalize_teacher_status(payload.get("status"))
    raw_json = {
        "source_teacher_id": source_teacher_id,
        "name": payload["name"],
        "phone": payload.get("phone"),
        "subjects": subjects,
        "status": status,
    }
    data = teachers_repository.create_teacher(
        source_teacher_id=source_teacher_id,
        name=payload["name"],
        phone=payload.get("phone"),
        raw_json=raw_json,
    )
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.create",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"request": payload, "result": data},
    )
    return {"ok": True, "data": data}


def update_teacher(*, source_teacher_id: str, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    updates = dict(payload)
    if "status" in updates:
        updates["status"] = normalize_teacher_status(updates["status"])
    if "subjects" in updates:
        updates["subjects"] = normalize_subjects(updates["subjects"])
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")

    data = teachers_repository.update_teacher(source_teacher_id=source_teacher_id, updates=updates)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.update",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"request": updates, "result": data},
    )
    return {"ok": True, "data": data}


def update_teacher_status(*, source_teacher_id: str, status: str, ctx: OperatorContext) -> dict[str, Any]:
    normalized_status = normalize_teacher_status(status)
    data = teachers_repository.update_teacher_status(source_teacher_id=source_teacher_id, status=normalized_status)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.status_change",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"status": normalized_status, "result": data},
    )
    return {"ok": True, "data": data}
