from typing import Any

from ..core.schema import ensure_schedule_events_table
from ..db import fetch_one, fetch_rows
from ..utils.pagination import pager


def list_schedules(*, q: str | None, date: str | None, page: int, page_size: int) -> dict[str, Any]:
    ensure_schedule_events_table()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
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
        select id::text as id, 'time'::text as view_key, start_time as date_time,
               to_char(start_time at time zone 'Pacific/Auckland', 'YYYY-MM-DD HH24:MI') || ' - ' ||
               to_char(end_time at time zone 'Pacific/Auckland', 'HH24:MI') as time_range,
               class_name, teacher_name, coalesce(room_name, '-') as room_name, '-'::text as student_name, status
        from amilyhub.schedule_events
        {condition}
        order by start_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}
