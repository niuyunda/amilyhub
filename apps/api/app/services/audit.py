import json
from typing import Any

from ..repositories import audit as audit_repository


def list_audit_logs(
    *,
    action: str | None,
    operator: str | None,
    start_time: str | None,
    end_time: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    audit_repository.ensure_audit_logs_table()
    clauses: list[str] = []
    params: list[Any] = []
    if action:
        clauses.append("action ilike %s")
        params.append(f"{action.strip()}%")
    if operator:
        clauses.append("operator = %s")
        params.append(operator.strip())
    if start_time:
        clauses.append("created_at >= %s::timestamptz")
        params.append(start_time.strip())
    if end_time:
        clauses.append("created_at <= %s::timestamptz")
        params.append(end_time.strip())
    return audit_repository.list_audit_logs(clauses=clauses, params=params, limit=limit)


def write_audit_log(
    *,
    operator: str,
    role: str,
    action: str,
    resource_type: str,
    resource_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    try:
        audit_repository.ensure_audit_logs_table()
        audit_repository.insert_audit_log(
            operator=operator,
            role=role,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            payload=json.dumps(payload or {}, ensure_ascii=False, default=str),
        )
    except Exception:
        pass
