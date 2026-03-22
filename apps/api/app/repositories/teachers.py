import json
from typing import Any

from ..core.errors import ApiError
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager


def list_teachers(
    *,
    q: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    page, page_size, offset = pager(page, page_size)
    clauses: list[str] = [
        "name IS NOT NULL AND coalesce(name, '') NOT ILIKE '%%RBAC%%'",
        "coalesce(name, '') NOT ILIKE '%%Teacher Dup%%'",
    ]
    params: list[Any] = []
    if q:
        params.extend([f"%{q}%", f"%{q}%"])
        clauses.append("(name ilike %s or phone ilike %s)")
    if status:
        clauses.append("coalesce(nullif(raw_json->>'status',''),'在职') = %s")
        params.append(status)
    condition = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.teachers {condition}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select
          id,
          source_teacher_id,
          name,
          phone,
          gender,
          last_month_lessons,
          current_month_lessons,
          total_finished_lessons,
          coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
          coalesce(nullif(raw_json->>'status',''),'在职') as status
        from amilyhub.teachers
        {condition}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}


def create_teacher(*, source_teacher_id: str, name: str, phone: str | None, raw_json: dict[str, Any]) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.teachers where source_teacher_id=%s", (source_teacher_id,))
        if cur.fetchone():
            raise ApiError(409, "TEACHER_EXISTS", "teacher already exists")
        cur.execute(
            """
            insert into amilyhub.teachers(source_teacher_id, name, phone, raw_json)
            values (%s, %s, %s, %s::jsonb)
            returning id, source_teacher_id, name, phone,
                      coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                      coalesce(nullif(raw_json->>'status',''),'在职') as status
            """,
            (source_teacher_id, name, phone, json.dumps(raw_json, ensure_ascii=False)),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_teacher(*, source_teacher_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            select source_teacher_id, name, phone, coalesce(raw_json, '{}'::jsonb) as raw_json
            from amilyhub.teachers
            where source_teacher_id=%s
            """,
            (source_teacher_id,),
        )
        found = cur.fetchone()
        if not found:
            raise ApiError(404, "TEACHER_NOT_FOUND", "teacher not found")
        found_cols = [d.name for d in cur.description]
        current = dict(zip(found_cols, found))

        next_name = updates.get("name", current.get("name"))
        next_phone = updates.get("phone", current.get("phone"))
        raw_patch = {**updates, "source_teacher_id": source_teacher_id, "name": next_name, "phone": next_phone}
        cur.execute(
            """
            update amilyhub.teachers
            set
              name=%s,
              phone=%s,
              raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_teacher_id=%s
            returning id, source_teacher_id, name, phone,
                      coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                      coalesce(nullif(raw_json->>'status',''),'在职') as status
            """,
            (next_name, next_phone, json.dumps(raw_patch, ensure_ascii=False), source_teacher_id),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_teacher_status(*, source_teacher_id: str, status: str) -> dict[str, Any]:
    raw_patch = {"status": status}
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            update amilyhub.teachers
            set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_teacher_id=%s
            returning id, source_teacher_id, name, phone,
                      coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                      coalesce(nullif(raw_json->>'status',''),'在职') as status
            """,
            (json.dumps(raw_patch, ensure_ascii=False), source_teacher_id),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "TEACHER_NOT_FOUND", "teacher not found")
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))
