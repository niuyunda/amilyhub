from ..core.runtime import is_initialized, mark_initialized
from ..db import fetch_rows, get_transaction_cursor


def ensure_role_permissions_table(default_role_permissions: dict[str, set[str]]) -> None:
    if is_initialized("rbac_role_permissions"):
        return
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            create table if not exists amilyhub.rbac_role_permissions (
              role text not null,
              permission text not null,
              updated_at timestamptz not null default now(),
              primary key (role, permission)
            )
            """
        )
        cur.execute("create index if not exists idx_rbac_role_permissions_role on amilyhub.rbac_role_permissions(role)")
        for role, permissions in default_role_permissions.items():
            for permission in permissions:
                cur.execute(
                    """
                    insert into amilyhub.rbac_role_permissions(role, permission)
                    values (%s, %s)
                    on conflict (role, permission) do nothing
                    """,
                    (role, permission),
                )
    mark_initialized("rbac_role_permissions")


def fetch_role_permissions() -> list[dict[str, str]]:
    return fetch_rows("select role, permission from amilyhub.rbac_role_permissions")


def replace_role_permissions(role_name: str, permissions: list[str]) -> None:
    with get_transaction_cursor() as cur:
        cur.execute("delete from amilyhub.rbac_role_permissions where role=%s", (role_name,))
        for permission in permissions:
            cur.execute(
                """
                insert into amilyhub.rbac_role_permissions(role, permission)
                values (%s, %s)
                """,
                (role_name, permission),
            )
