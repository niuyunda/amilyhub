import json
import random
import time
from datetime import date
from typing import Any

from ..core.errors import ApiError
from ..core.schema import ensure_order_events_table
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.finance import generate_income_expense_id
from ..utils.querying import list_query
from ..utils.students import assert_student_exists
from .order_events import create_order_event, has_order_event


def list_orders(*, student_id: str | None, state: str | None, page: int, page_size: int) -> dict[str, Any]:
    clauses, params = [], []
    if student_id:
        clauses.append("o.source_student_id = %s")
        params.append(student_id)
    if state:
        clauses.append("o.order_state = %s")
        params.append(state)
    condition = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.orders o {condition}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select o.id, o.source_order_id, o.source_student_id, coalesce(s.name, '-') as student_name, o.order_type, o.order_state,
               o.receivable_cents, o.received_cents, o.arrears_cents, o.source_created_at, o.source_paid_at
        from amilyhub.orders o
        left join amilyhub.students s on s.source_student_id = o.source_student_id
        {condition}
        order by o.id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, (max(page, 1) - 1) * min(max(page_size, 1), 200)]),
    )
    return {"rows": rows, "page": max(page, 1), "page_size": min(max(page_size, 1), 200), "total": total}


def get_order(source_order_id: str) -> dict[str, Any]:
    row = fetch_one(
        """
        select id, source_order_id, source_student_id, order_type, order_state,
               receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
        from amilyhub.orders where source_order_id=%s
        """,
        (source_order_id,),
    )
    if not row:
        raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
    return row


def create_order(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_order_events_table()
    if payload.get("source_student_id"):
        assert_student_exists(payload["source_student_id"])
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.orders where source_order_id=%s", (payload["source_order_id"],))
        if cur.fetchone():
            raise ApiError(409, "ORDER_EXISTS", "order already exists")
        cur.execute(
            """
            insert into amilyhub.orders
            (source_order_id, source_student_id, order_type, order_state, receivable_cents, received_cents, arrears_cents, raw_json)
            values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            returning id, source_order_id, source_student_id, order_type, order_state,
                      receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
            """,
            (
                payload["source_order_id"],
                payload.get("source_student_id"),
                payload.get("order_type"),
                payload.get("order_state"),
                payload.get("receivable_cents"),
                payload.get("received_cents"),
                payload.get("arrears_cents"),
                json.dumps(payload, ensure_ascii=False, default=str),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
        create_order_event(cur, payload["source_order_id"], "create", payload)
    return dict(zip(cols, row))


def create_order_renewal(payload: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, Any]]:
    ensure_order_events_table()
    assert_student_exists(payload["source_student_id"])
    source_order_id = f"RNEW{int(time.time() * 1000)}{random.randint(100,999)}"
    order_state = "已支付" if payload.get("arrears_cents", 0) == 0 else "待支付"
    raw = {**payload, "source_order_id": source_order_id, "order_type": "续费"}
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            insert into amilyhub.orders
            (source_order_id, source_student_id, order_type, order_state, receivable_cents, received_cents, arrears_cents, raw_json)
            values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            returning id, source_order_id, source_student_id, order_type, order_state,
                      receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
            """,
            (
                source_order_id,
                payload["source_student_id"],
                "续费",
                order_state,
                payload.get("receivable_cents", 0),
                payload.get("received_cents", 0),
                payload.get("arrears_cents", 0),
                json.dumps(raw, ensure_ascii=False, default=str),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
        create_order_event(cur, source_order_id, "renewal", raw)
    return source_order_id, raw, dict(zip(cols, row))


def update_order(source_order_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    if updates.get("source_student_id"):
        assert_student_exists(updates["source_student_id"])
    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
    set_parts.append("raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb")
    values.append(json.dumps(updates, ensure_ascii=False, default=str))
    values.append(source_order_id)
    with get_transaction_cursor() as cur:
        cur.execute(
            f"""
            update amilyhub.orders
            set {', '.join(set_parts)}
            where source_order_id=%s
            returning id, source_order_id, source_student_id, order_type, order_state,
                      receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def void_order(source_order_id: str, *, operator: str, reason: str) -> tuple[dict[str, Any], dict[str, Any]]:
    ensure_order_events_table()
    event_payload = {"source_order_id": source_order_id, "operator": operator, "reason": reason, "action": "void"}
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            update amilyhub.orders
            set order_state=%s, raw_json = coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_order_id=%s
            returning id, source_order_id, source_student_id, order_type, order_state,
                      receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
            """,
            ("已作废", json.dumps({"voided": True, "void_reason": reason, "void_operator": operator}, ensure_ascii=False), source_order_id),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
        cols = [d.name for d in cur.description]
        if not has_order_event(cur, source_order_id, "void"):
            create_order_event(cur, source_order_id, "void", event_payload, operator=operator, reason=reason)
    return event_payload, dict(zip(cols, row))


def refund_order(source_order_id: str, *, operator: str, reason: str) -> tuple[dict[str, Any], dict[str, Any]]:
    ensure_order_events_table()
    event_payload = {"source_order_id": source_order_id, "operator": operator, "reason": reason, "action": "refund"}
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            update amilyhub.orders
            set order_type=%s, order_state=%s, raw_json = coalesce(raw_json, '{}'::jsonb) || %s::jsonb
            where source_order_id=%s
            returning id, source_order_id, source_student_id, order_type, order_state,
                      receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at,
                      coalesce(raw_json, '{}'::jsonb) as raw_json
            """,
            ("退费", "已作废", json.dumps({"refunded": True, "refund_reason": reason, "refund_operator": operator}, ensure_ascii=False), source_order_id),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
        cols = [d.name for d in cur.description]
        data = dict(zip(cols, row))
        if not has_order_event(cur, source_order_id, "refund"):
            create_order_event(cur, source_order_id, "refund", event_payload, operator=operator, reason=reason)
        refund_amount = data.get("received_cents") or 0
        if refund_amount > 0:
            order_raw = data.get("raw_json") or {}
            payment_method = order_raw.get("payment_method") if isinstance(order_raw, dict) else None
            expense_source_id = generate_income_expense_id()
            expense_raw = {
                "payment_method": payment_method or "-",
                "operator": operator,
                "remark": f"退费订单 {source_order_id}，原因: {reason}",
                "source_order_id": source_order_id,
            }
            cur.execute(
                """
                insert into amilyhub.income_expense
                (source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at, raw_json)
                values (%s, %s, %s, %s, %s, %s, now(), %s::jsonb)
                """,
                (expense_source_id, source_order_id, "退费", "支出", refund_amount, date.today(), json.dumps(expense_raw, ensure_ascii=False, default=str)),
            )
    return event_payload, data
