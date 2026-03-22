import time
from collections import defaultdict

from ..core.errors import ApiError
from ..repositories import rbac as rbac_repository


DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"teachers:write", "finance:write", "orders:write", "schedule:write", "audit:read", "rbac:write"},
    "manager": {"teachers:write", "orders:write", "schedule:write", "audit:read"},
    "staff": set(),
}
KNOWN_PERMISSIONS: set[str] = set().union(*DEFAULT_ROLE_PERMISSIONS.values())
ROLE_PERMISSIONS: dict[str, set[str]] = {role: set(permissions) for role, permissions in DEFAULT_ROLE_PERMISSIONS.items()}
RBAC_CACHE_TTL_SECONDS = 5
RBAC_CACHE_UPDATED_AT = 0.0


def get_role_permissions(*, force: bool = False) -> dict[str, set[str]]:
    global RBAC_CACHE_UPDATED_AT
    now = time.time()
    if not force and ROLE_PERMISSIONS and now - RBAC_CACHE_UPDATED_AT < RBAC_CACHE_TTL_SECONDS:
        return ROLE_PERMISSIONS

    rbac_repository.ensure_role_permissions_table(DEFAULT_ROLE_PERMISSIONS)
    rows = rbac_repository.fetch_role_permissions()
    permissions_map: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        role = (row.get("role") or "").strip().lower()
        permission = (row.get("permission") or "").strip()
        if role and permission:
            permissions_map[role].add(permission)
    for role in DEFAULT_ROLE_PERMISSIONS:
        permissions_map.setdefault(role, set())

    ROLE_PERMISSIONS.clear()
    ROLE_PERMISSIONS.update({role: set(permissions) for role, permissions in permissions_map.items()})
    RBAC_CACHE_UPDATED_AT = now
    return ROLE_PERMISSIONS


def list_role_permissions() -> list[dict[str, object]]:
    role_permissions = get_role_permissions(force=True)
    return [
        {"role": role, "permissions": sorted(list(permissions))}
        for role, permissions in sorted(role_permissions.items(), key=lambda item: item[0])
    ]


def update_role_permissions(role: str, permissions: list[str]) -> dict[str, object]:
    role_name = (role or "").strip().lower()
    if not role_name:
        raise ApiError(422, "INVALID_ROLE", "角色名不能为空")

    unknown_permissions = sorted({item.strip() for item in permissions if item.strip() and item.strip() not in KNOWN_PERMISSIONS})
    if unknown_permissions:
        raise ApiError(422, "INVALID_PERMISSION", "存在未知权限点", details={"unknown_permissions": unknown_permissions})

    normalized_permissions = sorted({item.strip() for item in permissions if item.strip()})
    before_permissions = sorted(list(get_role_permissions(force=True).get(role_name, set())))
    rbac_repository.replace_role_permissions(role_name, normalized_permissions)
    get_role_permissions(force=True)
    return {"role": role_name, "before": before_permissions, "after": normalized_permissions}
