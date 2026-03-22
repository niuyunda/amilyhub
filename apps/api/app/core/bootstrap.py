from ..repositories import audit as audit_repository
from ..services.rbac import DEFAULT_ROLE_PERMISSIONS
from ..repositories import rbac as rbac_repository
from .schema import (
    ensure_courses_table,
    ensure_new_tables,
    ensure_order_events_table,
    ensure_rooms_table,
    ensure_schedule_events_table,
)
from .runtime import mark_bootstrap_ready


def bootstrap_runtime_schema() -> None:
    ensure_new_tables()
    rbac_repository.ensure_role_permissions_table(DEFAULT_ROLE_PERMISSIONS)
    audit_repository.ensure_audit_logs_table()
    ensure_rooms_table()
    ensure_courses_table()
    ensure_order_events_table()
    ensure_schedule_events_table()
    mark_bootstrap_ready()
