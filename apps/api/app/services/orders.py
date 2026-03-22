from typing import Any

from ..dependencies.operator import OperatorContext
from ..repositories import orders as orders_repository
from ..services.audit import write_audit_log
from ..utils.pagination import page_payload


def list_orders(**kwargs: Any) -> dict[str, Any]:
    result = orders_repository.list_orders(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}


def get_order(source_order_id: str) -> dict[str, Any]:
    return {"ok": True, "data": orders_repository.get_order(source_order_id)}


def create_order(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": orders_repository.create_order(payload)}


def create_order_renewal(payload: dict[str, Any], ctx: OperatorContext) -> dict[str, Any]:
    source_order_id, raw, data = orders_repository.create_order_renewal(payload)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="orders.renewal", resource_type="order", resource_id=source_order_id, payload={"request": raw, "result": data})
    return {"ok": True, "data": data}


def update_order(source_order_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": orders_repository.update_order(source_order_id, payload)}


def void_order(source_order_id: str, operator: str, reason: str, ctx: OperatorContext) -> dict[str, Any]:
    event_payload, data = orders_repository.void_order(source_order_id, operator=operator, reason=reason)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="orders.void", resource_type="order", resource_id=source_order_id, payload={"request": event_payload, "result": data})
    return {"ok": True, "data": data}


def refund_order(source_order_id: str, operator: str, reason: str, ctx: OperatorContext) -> dict[str, Any]:
    event_payload, data = orders_repository.refund_order(source_order_id, operator=operator, reason=reason)
    write_audit_log(operator=ctx.operator, role=ctx.role, action="orders.refund", resource_type="order", resource_id=source_order_id, payload={"request": event_payload, "result": data})
    return {"ok": True, "data": data}
