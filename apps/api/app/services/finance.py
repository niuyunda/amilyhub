from datetime import date
from typing import Any

from ..dependencies.operator import OperatorContext
from ..repositories import finance as finance_repository
from ..services.audit import write_audit_log


def list_hour_cost_flows(**kwargs: Any) -> dict[str, Any]:
    return finance_repository.list_hour_cost_flows(**kwargs)


def create_income_expense(payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    source_record_id, data = finance_repository.create_income_expense(payload)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="finance.create", resource_type="income_expense", resource_id=source_record_id, payload={"request": payload, "result": data})
    return {"ok": True, "data": data}


def update_income_expense(source_record_id: str, payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    data = finance_repository.update_income_expense(source_record_id, payload)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="finance.update", resource_type="income_expense", resource_id=source_record_id, payload={"request": payload, "result": data})
    return {"ok": True, "data": data}


def void_income_expense(source_record_id: str, operator: str, reason: str, ctx: OperatorContext) -> dict[str, Any]:
    data = finance_repository.void_income_expense(source_record_id, operator=operator, reason=reason)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="finance.void", resource_type="income_expense", resource_id=source_record_id, payload={"operator": operator, "reason": reason, "result": data})
    return {"ok": True, "data": data}


def list_income_expense(**kwargs: Any) -> dict[str, Any]:
    return finance_repository.list_income_expense(**kwargs)


def income_expense_summary(*, direction: str | None, operation_date_from: date | None, operation_date_to: date | None) -> dict[str, Any]:
    return {"ok": True, "data": finance_repository.income_expense_summary(direction=direction, operation_date_from=operation_date_from, operation_date_to=operation_date_to)}
