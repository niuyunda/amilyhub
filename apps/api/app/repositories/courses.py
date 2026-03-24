from typing import Any

from ..db import fetch_one, fetch_rows
from ..utils.pagination import pager


def list_courses_db(
    *,
    q: str | None,
    course_type: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    page_obj, page_size, offset = pager(page, page_size)
    clauses: list[str] = []
    params: list[Any] = []

    if q:
        clauses.append("name ilike %s")
        params.append(f"%{q}%")
    if course_type:
        clauses.append("course_type = %s")
        params.append(course_type)
    if status:
        clauses.append("status = %s")
        params.append(status)

    condition = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    total = fetch_one(
        f"SELECT COUNT(*) AS c FROM amilyhub.courses {condition}",
        tuple(params) if params else None,
    )
    rows = fetch_rows(
        f"""
        SELECT
            id,
            source_course_id AS source_id,
            name,
            course_type,
            fee_type,
            status,
            pricing_rules,
            pricing_items,
            student_num,
            validity_days,
            description,
            materials,
            created_at
        FROM amilyhub.courses
        {condition}
        ORDER BY id DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page_obj, "page_size": page_size, "total": int(total.get("c", 0) if total else 0)}


def create_course_db(payload: dict[str, Any]) -> dict[str, Any]:
    from ..db import get_transaction_cursor

    name = payload.get("name") or payload.get("course_name", "未命名课程")
    course_type = payload.get("course_type", "一对多")
    fee_type = payload.get("fee_type", "按课时")
    status = payload.get("status", "启用")
    pricing_rules = payload.get("pricing_rules", "-")
    pricing_items = payload.get("pricing_items", [])
    student_num = payload.get("student_num", 0)
    validity_days = payload.get("validity_days")
    description = payload.get("description")
    materials = payload.get("materials", [])

    with get_transaction_cursor() as cur:
        cur.execute(
            """
            INSERT INTO amilyhub.courses
                (source_course_id, name, course_type, fee_type, status, pricing_rules, pricing_items, student_num, validity_days, description, materials)
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s::jsonb)
            RETURNING id, source_course_id AS source_id, name, course_type, fee_type, status, pricing_rules, pricing_items, student_num, validity_days, description, materials, created_at
            """,
            (
                f"LOCAL_{None}",
                name,
                course_type,
                fee_type,
                status,
                pricing_rules,
                __import__("json").dumps(pricing_items),
                student_num,
                validity_days,
                description,
                __import__("json").dumps(materials) if materials else None,
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_course_db(course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    from ..db import get_transaction_cursor

    updates: dict[str, Any] = {}
    if "name" in payload or "course_name" in payload:
        updates["name"] = payload.get("name") or payload.get("course_name")
    if "course_type" in payload:
        updates["course_type"] = payload["course_type"]
    if "fee_type" in payload:
        updates["fee_type"] = payload["fee_type"]
    if "status" in payload:
        updates["status"] = payload["status"]
    if "pricing_rules" in payload:
        updates["pricing_rules"] = payload["pricing_rules"]
    if "pricing_items" in payload:
        updates["pricing_items"] = __import__("json").dumps(payload["pricing_items"])
    if "student_num" in payload:
        updates["student_num"] = payload["student_num"]
    if "validity_days" in payload:
        updates["validity_days"] = payload["validity_days"]
    if "description" in payload:
        updates["description"] = payload["description"]
    if "materials" in payload:
        updates["materials"] = __import__("json").dumps(payload["materials"])

    if not updates:
        return {}

    set_clauses = [f"{k} = %s" for k in updates]
    set_clauses.append("updated_at = NOW()")
    values = list(updates.values()) + [course_id]

    with get_transaction_cursor() as cur:
        cur.execute(
            f"""
            UPDATE amilyhub.courses
            SET {', '.join(set_clauses)}
            WHERE id = %s OR source_course_id = %s
            RETURNING id, source_course_id AS source_id, name, course_type, fee_type, status, pricing_rules, pricing_items, student_num, validity_days, description, materials, created_at, updated_at
            """,
            tuple(values + [course_id]),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row)) if row else {}


def delete_course_db(course_id: str) -> dict[str, Any]:
    from ..db import get_transaction_cursor

    with get_transaction_cursor() as cur:
        cur.execute(
            "DELETE FROM amilyhub.courses WHERE id = %s OR source_course_id = %s RETURNING id",
            (course_id, course_id),
        )
        row = cur.fetchone()
    return {"id": str(row["id"]) if row else course_id}
