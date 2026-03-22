import json
from typing import Any

from ..core.errors import ApiError
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager


def list_schedule_events(*, q: str | None, date: str | None, page: int, page_size: int) -> dict[str, Any]:
    page, page_size, offset = pager(page, page_size)
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append("(class_name ilike %s or teacher_name ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if date:
        clauses.append("to_char(start_time at time zone 'Pacific/Auckland', 'YYYY-MM-DD') = %s")
        params.append(date)
    condition = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.schedule_events {condition}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select
          id,
          class_name,
          teacher_name,
          room_name,
          room_id,
          status,
          start_time,
          end_time,
          source_course_id,
          source_class_id,
          note
        from amilyhub.schedule_events
        {condition}
        order by start_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}


def create_schedule_event(*, payload: dict[str, Any]) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        _assert_no_schedule_conflicts(cur, payload=payload)
        cur.execute(
            """
            insert into amilyhub.schedule_events
            (class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note, raw_json)
            values (%s,%s,%s::timestamptz,%s::timestamptz,%s,%s,%s,%s,%s,%s,%s::jsonb)
            returning id, class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note
            """,
            (
                payload["class_name"],
                payload["teacher_name"],
                payload["start_time"],
                payload["end_time"],
                payload.get("room_name"),
                payload.get("room_id"),
                payload.get("status", "planned"),
                payload.get("source_course_id"),
                payload.get("source_class_id"),
                payload.get("note"),
                json.dumps(payload, ensure_ascii=False, default=str),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_schedule_event(*, event_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        _assert_no_schedule_conflicts(cur, payload=payload, exclude_event_id=event_id)
        cur.execute(
            """
            update amilyhub.schedule_events
            set class_name=%s, teacher_name=%s, start_time=%s::timestamptz, end_time=%s::timestamptz,
                room_name=%s, room_id=%s, status=%s, source_course_id=%s, source_class_id=%s,
                note=%s, raw_json=%s::jsonb, updated_at=now()
            where id=%s
            returning id, class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note
            """,
            (
                payload["class_name"],
                payload["teacher_name"],
                payload["start_time"],
                payload["end_time"],
                payload.get("room_name"),
                payload.get("room_id"),
                payload.get("status", "planned"),
                payload.get("source_course_id"),
                payload.get("source_class_id"),
                payload.get("note"),
                json.dumps(payload, ensure_ascii=False, default=str),
                event_id,
            ),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "SCHEDULE_EVENT_NOT_FOUND", "schedule event not found")
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def delete_schedule_event(event_id: int) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        cur.execute("delete from amilyhub.schedule_events where id=%s returning id", (event_id,))
        if cur.fetchone() is None:
            raise ApiError(404, "SCHEDULE_EVENT_NOT_FOUND", "schedule event not found")
    return {"id": event_id}


def _assert_no_schedule_conflicts(cur: Any, *, payload: dict[str, Any], exclude_event_id: int | None = None) -> None:
    exclusion_clause = "id != %s and " if exclude_event_id is not None else ""
    teacher_params: list[Any] = []
    if exclude_event_id is not None:
        teacher_params.append(exclude_event_id)
    teacher_params.extend([payload["teacher_name"], payload["start_time"], payload["end_time"]])
    cur.execute(
        f"""
        select 1
        from amilyhub.schedule_events
        where {exclusion_clause}teacher_name = %s
          and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
        limit 1
        """,
        tuple(teacher_params),
    )
    if cur.fetchone():
        raise ApiError(409, "SCHEDULE_CONFLICT", "teacher already has a schedule at this time")

    room_id = payload.get("room_id")
    if not room_id:
        return

    room_params: list[Any] = []
    if exclude_event_id is not None:
        room_params.append(exclude_event_id)
    room_params.extend([room_id, payload["start_time"], payload["end_time"]])
    cur.execute(
        f"""
        select 1
        from amilyhub.schedule_events
        where {exclusion_clause}room_id = %s
          and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
        limit 1
        """,
        tuple(room_params),
    )
    if cur.fetchone():
        raise ApiError(409, "ROOM_CONFLICT", "room is already booked at this time")

    cur.execute("select capacity from amilyhub.rooms where id=%s", (room_id,))
    room_row = cur.fetchone()
    if not room_row:
        raise ApiError(404, "ROOM_NOT_FOUND", "room not found")

    room_capacity = room_row["capacity"] or 0
    source_class_id = payload.get("source_class_id")
    if not source_class_id or room_capacity <= 0:
        return

    cur.execute("select capacity from amilyhub.classes where source_class_id=%s", (source_class_id,))
    class_row = cur.fetchone()
    if class_row and class_row["capacity"] and class_row["capacity"] > room_capacity:
        raise ApiError(
            409,
            "ROOM_CAPACITY_EXCEEDED",
            f"class capacity ({class_row['capacity']}) exceeds room capacity ({room_capacity})",
        )
