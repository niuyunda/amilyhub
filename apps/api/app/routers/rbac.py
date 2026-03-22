from fastapi import APIRouter, Depends

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.rbac import RbacRoleUpdateRequest
from ..services.audit import write_audit_log
from ..services.rbac import list_role_permissions, update_role_permissions


router = APIRouter(tags=["rbac"])


@router.get("/api/v1/rbac/roles", response_model=ListResponse)
def get_rbac_roles(_: OperatorContext = Depends(require_permission("rbac:write"))) -> dict[str, object]:
    rows = list_role_permissions()
    return {"ok": True, "data": rows, "page": {"page": 1, "page_size": len(rows), "total": len(rows)}}


@router.put("/api/v1/rbac/roles/{role}", response_model=ObjectResponse)
def put_rbac_role(
    role: str,
    body: RbacRoleUpdateRequest,
    ctx: OperatorContext = Depends(require_permission("rbac:write")),
) -> dict[str, object]:
    result = update_role_permissions(role, body.permissions)
    before_set = set(result["before"])
    after_set = set(result["after"])
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="rbac.role_permissions.update",
        resource_type="rbac_role",
        resource_id=result["role"],
        payload={
            "before": result["before"],
            "after": result["after"],
            "diff": {
                "added": sorted(list(after_set - before_set)),
                "removed": sorted(list(before_set - after_set)),
            },
        },
    )
    return {"ok": True, "data": {"role": result["role"], "permissions": result["after"]}}
