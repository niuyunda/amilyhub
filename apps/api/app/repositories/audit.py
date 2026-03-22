from typing import Any

from ..core.runtime import is_initialized, mark_initialized
from ..db import fetch_rows, get_transaction_cursor


def ensure_audit_logs_table() -> None:
    if is_initialized("audit_logs"):
        return
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            create table if not exists amilyhub.audit_logs (
              id bigserial primary key,
              operator text,
              role text,
              action text not null,
              resource_type text not null,
              resource_id text,
              payload jsonb not null default '{}'::jsonb,
              created_at timestamptz default now()
            )
            """
        )
        cur.execute("create index if not exists idx_audit_logs_resource on amilyhub.audit_logs(resource_type, resource_id)")
    mark_initialized("audit_logs")


def insert_audit_log(
    *,
    operator: str,
    role: str,
    action: str,
    resource_type: str,
    resource_id: str,
    payload: str,
) -> None:
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            insert into amilyhub.audit_logs(operator, role, action, resource_type, resource_id, payload)
            values (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (operator, role, action, resource_type, resource_id, payload),
        )


def list_audit_logs(*, clauses: list[str], params: list[Any], limit: int) -> list[dict[str, Any]]:
    condition = f"where {' and '.join(clauses)}" if clauses else ""
    return fetch_rows(
        f"""
        select operator, role, action, resource_type, resource_id, payload, created_at
        from amilyhub.audit_logs
        {condition}
        order by created_at desc, id desc
        limit %s
        """,
        tuple(params + [limit]),
    )
