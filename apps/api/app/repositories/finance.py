import json
from datetime import date
from typing import Any

from ..core.errors import ApiError
from ..db import fetch_one, get_transaction_cursor
from ..utils.pagination import as_int
from ..utils.finance import generate_income_expense_id, normalize_direction, normalize_record_status
from ..utils.querying import list_query


def list_hour_cost_flows(*, student_id: str | None, teacher_id: str | None, cost_type: str | None, source_type: str | None, checked_from: date | None, checked_to: date | None, page: int, page_size: int) -> dict[str, Any]:
    clauses, params = [], []
    if student_id:
        clauses.append("source_student_id = %s")
        params.append(student_id)
    if teacher_id:
        clauses.append("source_teacher_id = %s")
        params.append(teacher_id)
    if cost_type:
        clauses.append("cost_type = %s")
        params.append(cost_type)
    if source_type:
        clauses.append("source_type = %s")
        params.append(source_type)
    if checked_from:
        clauses.append("checked_at::date >= %s")
        params.append(checked_from)
    if checked_to:
        clauses.append("checked_at::date <= %s")
        params.append(checked_to)
    return list_query("hour_cost_flows", "id, source_id, source_student_id, source_teacher_id, source_class_id, source_course_id, cost_type, source_type, cost_hours, cost_amount_cents, checked_at, source_created_at", clauses, params, page, page_size)


def create_income_expense(payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    source_record_id = (payload.get("source_record_id") or "").strip() or generate_income_expense_id()
    direction = normalize_direction(payload["direction"])
    status = normalize_record_status(payload.get("status"))
    raw_json = {
        "source_record_id": source_record_id,
        "payment_method": payload.get("payment_method"),
        "operator": payload.get("operator"),
        "remark": payload.get("remark"),
        "status": status,
    }
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.income_expense where source_id=%s", (source_record_id,))
        if cur.fetchone():
            raise ApiError(409, "INCOME_EXPENSE_EXISTS", "income_expense record already exists")
        cur.execute(
            """
            insert into amilyhub.income_expense
            (source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at, raw_json)
            values (%s, %s, %s, %s, %s, %s, now(), %s::jsonb)
            returning id, source_id as source_record_id, source_id, source_order_id, item_type, direction, amount_cents,
                      operation_date, source_created_at, coalesce(raw_json->>'payment_method', '-') as payment_method,
                      coalesce(raw_json->>'operator', '-') as operator, coalesce(raw_json->>'remark', '') as remark,
                      coalesce(nullif(raw_json->>'status',''),'正常') as status
            """,
            (
                source_record_id,
                payload.get("source_order_id"),
                payload["item_type"],
                direction,
                payload["amount_cents"],
                payload["operation_date"],
                json.dumps(raw_json, ensure_ascii=False, default=str),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return source_record_id, dict(zip(cols, row))


def update_income_expense(source_record_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    if "direction" in updates:
        updates["direction"] = normalize_direction(updates["direction"])
    if "status" in updates:
        updates["status"] = normalize_record_status(updates["status"])
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            select source_id, source_order_id, item_type, direction, amount_cents, operation_date, coalesce(raw_json, '{}'::jsonb) as raw_json
            from amilyhub.income_expense where source_id=%s
            """,
            (source_record_id,),
        )
        found = cur.fetchone()
        if not found:
            raise ApiError(404, "INCOME_EXPENSE_NOT_FOUND", "income_expense record not found")
        cols = [d.name for d in cur.description]
        current = dict(zip(cols, found))
        raw_patch = {k: updates[k] for k in ("payment_method", "operator", "remark", "status") if k in updates}
        cur.execute(
            """
            update amilyhub.income_expense
            set source_order_id=%s, item_type=%s, direction=%s, amount_cents=%s, operation_date=%s,
                raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_id=%s
            returning id, source_id as source_record_id, source_id, source_order_id, item_type, direction, amount_cents,
                      operation_date, source_created_at, coalesce(raw_json->>'payment_method', '-') as payment_method,
                      coalesce(raw_json->>'operator', '-') as operator, coalesce(raw_json->>'remark', '') as remark,
                      coalesce(nullif(raw_json->>'status',''),'正常') as status
            """,
            (
                updates.get("source_order_id", current.get("source_order_id")),
                updates.get("item_type", current.get("item_type")),
                updates.get("direction", current.get("direction")),
                updates.get("amount_cents", current.get("amount_cents")),
                updates.get("operation_date", current.get("operation_date")),
                json.dumps(raw_patch, ensure_ascii=False, default=str),
                source_record_id,
            ),
        )
        row = cur.fetchone()
        return dict(zip([d.name for d in cur.description], row))


def void_income_expense(source_record_id: str, *, operator: str, reason: str) -> dict[str, Any]:
    raw_patch = {"status": "作废", "void_operator": operator, "void_reason": reason}
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            update amilyhub.income_expense
            set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_id=%s
            returning id, source_id as source_record_id, source_id, source_order_id, item_type, direction, amount_cents,
                      operation_date, source_created_at, coalesce(raw_json->>'payment_method', '-') as payment_method,
                      coalesce(raw_json->>'operator', '-') as operator, coalesce(raw_json->>'remark', '') as remark,
                      coalesce(nullif(raw_json->>'status',''),'正常') as status
            """,
            (json.dumps(raw_patch, ensure_ascii=False), source_record_id),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "INCOME_EXPENSE_NOT_FOUND", "income_expense record not found")
        return dict(zip([d.name for d in cur.description], row))


def list_income_expense(*, q: str | None, direction: str | None, item_type: str | None, status: str | None, payment_method: str | None, operation_date_from: date | None, operation_date_to: date | None, page: int, page_size: int) -> dict[str, Any]:
    clauses, params = [], []
    if q:
        clauses.append("(source_id ilike %s or coalesce(item_type,'') ilike %s or coalesce(raw_json->>'operator','') ilike %s or coalesce(raw_json->>'remark','') ilike %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
    if direction:
        clauses.append("direction = %s")
        params.append(normalize_direction(direction))
    if item_type:
        clauses.append("item_type = %s")
        params.append(item_type)
    if status:
        clauses.append("coalesce(nullif(raw_json->>'status',''),'正常') = %s")
        params.append(normalize_record_status(status))
    if payment_method:
        clauses.append("coalesce(nullif(raw_json->>'payment_method',''),'-') = %s")
        params.append(payment_method)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    return list_query("income_expense", "id, source_id as source_record_id, source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at, coalesce(raw_json->>'payment_method', '-') as payment_method, coalesce(raw_json->>'operator', '-') as operator, coalesce(raw_json->>'remark', '') as remark, coalesce(nullif(raw_json->>'status',''),'正常') as status", clauses, params, page, page_size)


def income_expense_summary(*, direction: str | None, operation_date_from: date | None, operation_date_to: date | None) -> dict[str, int]:
    clauses, params = [], []
    if direction:
        clauses.append("direction = %s")
        params.append(direction)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    condition = f" where {' and '.join(clauses)} " if clauses else ""
    row = fetch_one(
        f"""
        select count(*) as total_count,
               coalesce(sum(case when direction in ('收入','INCOME','IN') then amount_cents else 0 end),0) as income_cents,
               coalesce(sum(case when direction in ('支出','EXPENSE','OUT') then amount_cents else 0 end),0) as expense_cents
        from amilyhub.income_expense
        {condition}
        """,
        tuple(params),
    )
    income_cents = as_int(row["income_cents"])
    expense_cents = as_int(row["expense_cents"])
    return {"total_count": as_int(row["total_count"]), "income_cents": income_cents, "expense_cents": expense_cents, "net_income_cents": income_cents - expense_cents}
