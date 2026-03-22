from dataclasses import dataclass

from fastapi import Depends, Request

from ..core.errors import ApiError
from ..services.rbac import get_role_permissions


@dataclass
class OperatorContext:
    operator: str
    role: str


def get_operator_context(request: Request) -> OperatorContext:
    role_permissions = get_role_permissions()
    role = (request.headers.get("x-role") or "admin").strip().lower()
    if role not in role_permissions:
        role = "staff"
    operator = (request.headers.get("x-operator") or "unknown").strip() or "unknown"
    return OperatorContext(operator=operator, role=role)


def require_permission(permission: str):
    def dependency(ctx: OperatorContext = Depends(get_operator_context)) -> OperatorContext:
        role_permissions = get_role_permissions()
        if permission not in role_permissions.get(ctx.role, set()):
            raise ApiError(403, "FORBIDDEN", "无权限执行该操作")
        return ctx

    return dependency
