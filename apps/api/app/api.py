import json
import csv
import io
from collections import defaultdict
from datetime import date
import time
import random
from decimal import Decimal
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from .db import fetch_one, fetch_rows, get_conn


app = FastAPI(title="AmilyHub API", version="v1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error: ErrorInfo


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


@dataclass
class OperatorContext:
    operator: str
    role: str


DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"teachers:write", "finance:write", "orders:write", "schedule:write", "audit:read", "rbac:write"},
    "manager": {"teachers:write", "orders:write", "schedule:write", "audit:read"},
    "staff": set(),
}
KNOWN_PERMISSIONS: set[str] = set().union(*DEFAULT_ROLE_PERMISSIONS.values())
ROLE_PERMISSIONS: dict[str, set[str]] = {k: set(v) for k, v in DEFAULT_ROLE_PERMISSIONS.items()}
RBAC_CACHE_TTL_SECONDS = 5
RBAC_CACHE_UPDATED_AT = 0.0


def ensure_rbac_role_permissions_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
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
            for role, permissions in DEFAULT_ROLE_PERMISSIONS.items():
                for permission in permissions:
                    cur.execute(
                        """
                        insert into amilyhub.rbac_role_permissions(role, permission)
                        values (%s, %s)
                        on conflict (role, permission) do nothing
                        """,
                        (role, permission),
                    )
            conn.commit()


def refresh_role_permissions(force: bool = False) -> dict[str, set[str]]:
    global RBAC_CACHE_UPDATED_AT
    now = time.time()
    if not force and ROLE_PERMISSIONS and now - RBAC_CACHE_UPDATED_AT < RBAC_CACHE_TTL_SECONDS:
        return ROLE_PERMISSIONS

    ensure_rbac_role_permissions_table()
    rows = fetch_rows("select role, permission from amilyhub.rbac_role_permissions")
    permissions_map: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        role = (row.get("role") or "").strip().lower()
        permission = (row.get("permission") or "").strip()
        if role and permission:
            permissions_map[role].add(permission)
    for role in DEFAULT_ROLE_PERMISSIONS:
        permissions_map.setdefault(role, set())

    ROLE_PERMISSIONS.clear()
    ROLE_PERMISSIONS.update({role: set(perms) for role, perms in permissions_map.items()})
    RBAC_CACHE_UPDATED_AT = now
    return ROLE_PERMISSIONS


def get_operator_context(request: Request) -> OperatorContext:
    role_permissions = refresh_role_permissions()
    role = (request.headers.get("x-role") or "admin").strip().lower()
    if role not in role_permissions:
        role = "staff"
    operator = (request.headers.get("x-operator") or "unknown").strip() or "unknown"
    return OperatorContext(operator=operator, role=role)


def require_permission(request: Request, permission: str) -> OperatorContext:
    ctx = get_operator_context(request)
    role_permissions = refresh_role_permissions()
    if permission not in role_permissions.get(ctx.role, set()):
        raise ApiError(403, "FORBIDDEN", "无权限执行该操作")
    return ctx


def ensure_audit_logs_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
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
            conn.commit()


def write_audit_log(
    *,
    operator: str,
    role: str,
    action: str,
    resource_type: str,
    resource_id: str,
    payload: dict[str, Any] | None = None,
):
    try:
        ensure_audit_logs_table()
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into amilyhub.audit_logs(operator, role, action, resource_type, resource_id, payload)
                    values (%s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (operator, role, action, resource_type, resource_id, json.dumps(payload or {}, ensure_ascii=False, default=str)),
                )
                conn.commit()
    except Exception:
        # 审计日志失败时降级，不阻断主业务流程。
        pass


def build_audit_log_filters(
    *,
    action: str | None,
    operator: str | None,
    start_time: str | None,
    end_time: str | None,
) -> tuple[list[str], list[Any]]:
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
    return clauses, params


def fetch_audit_logs(
    *,
    action: str | None,
    operator: str | None,
    start_time: str | None,
    end_time: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    clauses, params = build_audit_log_filters(action=action, operator=operator, start_time=start_time, end_time=end_time)
    cond = f"where {' and '.join(clauses)}" if clauses else ""
    return fetch_rows(
        f"""
        select operator, role, action, resource_type, resource_id, payload, created_at
        from amilyhub.audit_logs
        {cond}
        order by created_at desc, id desc
        limit %s
        """,
        tuple(params + [limit]),
    )


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class ListResponse(BaseModel):
    ok: bool = True
    data: list[dict[str, Any]]
    page: PageMeta


class ObjectResponse(BaseModel):
    ok: bool = True
    data: dict[str, Any]


class RbacRoleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permissions: list[str] = Field(default_factory=list)


class StudentUpsertRequest(BaseModel):
    source_student_id: str | None = None
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birthday: date | None = None
    status: str | None = None
    # Audit fix: new student fields
    source: str | None = None
    grade: str | None = None
    school: str | None = None
    tags: list[str] | None = None
    follow_up_person: str | None = None
    edu_manager: str | None = None
    wechat_bound: bool | None = None
    face_captured: bool | None = None


class OrderUpsertRequest(BaseModel):
    source_order_id: str = Field(min_length=1)
    source_student_id: str | None = None
    order_type: str | None = None
    order_state: str | None = None
    receivable_cents: int | None = None
    received_cents: int | None = None
    arrears_cents: int | None = None


class StudentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birthday: date | None = None
    status: str | None = None
    # Audit fix: new student fields
    source: str | None = None
    grade: str | None = None
    school: str | None = None
    tags: list[str] | None = None
    follow_up_person: str | None = None
    edu_manager: str | None = None
    wechat_bound: bool | None = None
    face_captured: bool | None = None


class EnrollmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    course_name: str
    order_type: str = "报名"
    receivable_cents: int = 0
    received_cents: int = 0
    arrears_cents: int = 0


class OrderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_student_id: str | None = None
    order_type: str | None = None
    order_state: str | None = None
    receivable_cents: int | None = None
    received_cents: int | None = None
    arrears_cents: int | None = None


class OrderRenewalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_student_id: str
    receivable_cents: int = 0
    received_cents: int = 0
    arrears_cents: int = 0


class OrderActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: str | None = None
    reason: str | None = None


class TeacherCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_teacher_id: str | None = None
    name: str
    phone: str | None = None
    subjects: list[str] | None = None
    status: str = "在职"


class TeacherUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    subjects: list[str] | None = None
    status: str | None = None


class TeacherStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str


class IncomeExpenseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_record_id: str | None = None
    source_order_id: str | None = None
    item_type: str
    direction: str
    amount_cents: int = Field(ge=0)
    operation_date: date
    payment_method: str | None = None
    operator: str | None = None
    remark: str | None = None
    status: str = "正常"


class IncomeExpenseUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_order_id: str | None = None
    item_type: str | None = None
    direction: str | None = None
    amount_cents: int | None = Field(default=None, ge=0)
    operation_date: date | None = None
    payment_method: str | None = None
    operator: str | None = None
    remark: str | None = None
    status: str | None = None


class IncomeExpenseVoidRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: str | None = None
    reason: str | None = None


class ScheduleEventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_name: str
    teacher_name: str
    start_time: str
    end_time: str
    room_name: str | None = None
    room_id: int | None = None
    status: str = "planned"
    source_course_id: str | None = None
    source_class_id: str | None = None
    note: str | None = None


class RollcallConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = "正常"
    operator: str | None = None
    reason: str | None = None


class CourseUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_course_id: str | None = None
    name: str
    course_type: str = "一对多"
    fee_type: str = "按课时"
    status: str = "启用"
    pricing_rules: str = "-"
    pricing_items: list[dict[str, Any]] | None = None
    student_num: int = 0
    # Audit fix: new course fields
    validity_days: int = 0
    description: str = ""
    materials: list[str] | None = None


class DashboardSummary(BaseModel):
    students: int
    active_students: int
    teachers: int
    orders: int
    hour_cost_flows: int
    rollcalls: int
    income_expense: int
    income_cents: int
    expense_cents: int
    net_income_cents: int
    receivable_cents: int
    received_cents: int
    arrears_cents: int


class DashboardSummaryResponse(BaseModel):
    ok: bool = True
    data: DashboardSummary


class IncomeExpenseSummary(BaseModel):
    total_count: int
    income_cents: int
    expense_cents: int
    net_income_cents: int


class IncomeExpenseSummaryResponse(BaseModel):
    ok: bool = True
    data: IncomeExpenseSummary


class IntegrityIssue(BaseModel):
    kind: str
    table: str
    field: str | None = None
    value: str | None = None
    count: int
    note: str | None = None


class IntegrityCheckResponse(BaseModel):
    ok: bool = True
    data: dict[str, Any]


@app.exception_handler(ApiError)
def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(error=ErrorInfo(code=exc.code, message=exc.message, details=exc.details)).model_dump(),
    )


@app.exception_handler(RequestValidationError)
def validation_error_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error=ErrorInfo(code="VALIDATION_ERROR", message="invalid request", details={"errors": exc.errors()})
        ).model_dump(),
    )


def pager(page: int, page_size: int):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    return page, page_size, (page - 1) * page_size


def as_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return int(value)
    return int(value)


def generate_student_id() -> str:
    return f"STU{int(time.time() * 1000)}{random.randint(100, 999)}"


def generate_teacher_id() -> str:
    return f"TCH{int(time.time() * 1000)}{random.randint(100, 999)}"


def generate_income_expense_id() -> str:
    return f"FIN{int(time.time() * 1000)}{random.randint(100, 999)}"


def normalize_teacher_status(status: str | None) -> str:
    value = (status or "在职").strip()
    if value in {"在职", "启用", "active", "ACTIVE", "ON", "NORMAL"}:
        return "在职"
    if value in {"停用", "禁用", "离职", "inactive", "INACTIVE", "OFF", "DISABLED"}:
        return "停用"
    raise ApiError(422, "INVALID_TEACHER_STATUS", "invalid teacher status")


def normalize_subjects(subjects: list[str] | None) -> list[str]:
    cleaned: list[str] = []
    for subject in subjects or []:
        name = str(subject or "").strip()
        if name:
            cleaned.append(name)
    return cleaned[:20]


def normalize_direction(direction: str) -> str:
    value = str(direction or "").strip()
    if value in {"收入", "IN", "INCOME"}:
        return "收入"
    if value in {"支出", "OUT", "EXPENSE"}:
        return "支出"
    raise ApiError(422, "INVALID_DIRECTION", "direction must be 收入 or 支出")


def normalize_record_status(status: str | None) -> str:
    value = str((status or "正常")).strip()
    if value in {"正常", "有效", "normal", "NORMAL"}:
        return "正常"
    if value in {"作废", "VOID", "void", "voided", "VOIDED"}:
        return "作废"
    raise ApiError(422, "INVALID_RECORD_STATUS", "status must be 正常 or 作废")


def ensure_rooms_table():
    """Audit fix: ensure amilyhub.rooms table exists."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS amilyhub.rooms (
                    id BIGSERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    campus TEXT DEFAULT '' NOT NULL,
                    capacity INTEGER DEFAULT 0 NOT NULL,
                    status TEXT DEFAULT 'active' NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_rooms_name ON amilyhub.rooms(name)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_rooms_campus ON amilyhub.rooms(campus)")
            conn.commit()


def ensure_courses_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                create table if not exists amilyhub.courses (
                  id bigserial primary key,
                  source_course_id text unique,
                  name text not null,
                  course_type text,
                  fee_type text,
                  status text,
                  pricing_rules text,
                  pricing_items jsonb default '[]'::jsonb,
                  student_num int default 0,
                  price_per_hour integer default 0,
                  raw_source_json jsonb,
                  raw_json jsonb default '{}'::jsonb,
                  created_at timestamptz default now(),
                  updated_at timestamptz default now()
                )
                """
            )
            cur.execute("alter table amilyhub.courses add column if not exists pricing_items jsonb default '[]'::jsonb")
            cur.execute("alter table amilyhub.courses add column if not exists raw_source_json jsonb")
            cur.execute("alter table amilyhub.courses add column if not exists price_per_hour integer default 0")

            # Backfill once for old rows: keep source snapshot in raw_source_json,
            # move editable pricing to dedicated pricing_items.
            cur.execute(
                """
                update amilyhub.courses
                set pricing_items = coalesce(pricing_items, raw_json->'pricing_items', '[]'::jsonb)
                where pricing_items is null
                """
            )
            cur.execute(
                """
                update amilyhub.courses
                set raw_source_json = raw_json
                where raw_source_json is null
                  and source_course_id not like 'LOCAL_%'
                """
            )
            conn.commit()


def ensure_order_events_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                create table if not exists amilyhub.order_events (
                  id bigserial primary key,
                  order_id text,
                  source_order_id text not null,
                  event_type text not null,
                  payload jsonb not null default '{}'::jsonb,
                  operator text,
                  reason text,
                  created_at timestamptz default now()
                )
                """
            )
            cur.execute("alter table amilyhub.order_events add column if not exists order_id text")
            cur.execute("alter table amilyhub.order_events add column if not exists operator text")
            cur.execute("alter table amilyhub.order_events add column if not exists reason text")
            cur.execute(
                """
                update amilyhub.order_events
                set order_id = source_order_id
                where order_id is null
                """
            )
            cur.execute("create index if not exists idx_order_events_order on amilyhub.order_events(source_order_id)")
            cur.execute("create index if not exists idx_order_events_order_id on amilyhub.order_events(order_id)")
            conn.commit()


def create_order_event(
    cur,
    source_order_id: str,
    event_type: str,
    payload: dict[str, Any],
    *,
    operator: str | None = None,
    reason: str | None = None,
):
    cur.execute(
        """
        insert into amilyhub.order_events(order_id, source_order_id, event_type, payload, operator, reason)
        values (%s, %s, %s, %s::jsonb, %s, %s)
        """,
        (
            source_order_id,
            source_order_id,
            event_type,
            json.dumps(payload, ensure_ascii=False, default=str),
            operator,
            reason,
        ),
    )


def has_order_event(cur, source_order_id: str, event_type: str) -> bool:
    cur.execute(
        """
        select 1
        from amilyhub.order_events
        where source_order_id=%s and event_type=%s
        limit 1
        """,
        (source_order_id, event_type),
    )
    return cur.fetchone() is not None


def ensure_schedule_events_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                create table if not exists amilyhub.schedule_events (
                  id bigserial primary key,
                  class_name text not null,
                  teacher_name text not null,
                  start_time timestamptz not null,
                  end_time timestamptz not null,
                  room_name text,
                  room_id integer,
                  status text not null default 'planned',
                  source_course_id text,
                  source_class_id text,
                  note text,
                  raw_json jsonb not null default '{}'::jsonb,
                  created_at timestamptz default now(),
                  updated_at timestamptz default now()
                )
                """
            )
            cur.execute("alter table amilyhub.schedule_events add column if not exists room_id integer")
            cur.execute("create index if not exists idx_schedule_events_teacher_time on amilyhub.schedule_events(teacher_name, start_time, end_time)")
            conn.commit()


def ensure_new_tables():
    """Audit fix: run all DB migrations for new student/class/course fields."""
    import os as _os
    migration_path = _os.path.join(_os.path.dirname(__file__), "migrations", "add_student_class_fields.sql")
    if not _os.path.exists(migration_path):
        return
    with open(migration_path, "r") as f:
        sql = f.read()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            conn.commit()
    ensure_rooms_table()


def ensure_classes_table():
    """Audit fix: ensure amilyhub.classes table exists with proper schema."""
    ensure_new_tables()  # run all migrations first


def normalize_pricing_items(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for x in items or []:
        name = str((x or {}).get("name") or "").strip()
        if not name:
            continue
        quantity = float((x or {}).get("quantity") or 0)
        total_price = float((x or {}).get("totalPrice") or 0)
        price = (total_price / quantity) if quantity else 0.0
        normalized.append({
            "name": name,
            "quantity": quantity,
            "totalPrice": total_price,
            "price": price,
        })
    return normalized[:10]


def pricing_items_to_text(items: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for x in items:
        name = str(x.get("name") or "").strip()
        qty = float(x.get("quantity") or 0)
        total = float(x.get("totalPrice") or 0)
        price = float(x.get("price") or 0)
        if not name:
            continue
        if qty == 1:
            lines.append(f"{name}({price:g}元/课时)")
        else:
            lines.append(f"{name}({total:g}元{qty:g}课时)")
    return "\n".join(lines) if lines else "-"


def calculate_cost_amount_cents(
    source_class_id: str | None,
    source_course_id: str | None,
    class_time_range: str | None,
) -> int:
    """
    Calculate cost_amount_cents for a rollcall attendance.
    Looks up course price_per_hour or extracts from pricing_items,
    then multiplies by scheduled course hours.
    Returns 0 if no pricing info is available.
    """
    course_id: str | None = None

    if source_class_id:
        cls = fetch_one(
            "select course_id from amilyhub.classes where source_class_id=%s",
            (source_class_id,),
        )
        if cls:
            course_id = cls.get("course_id")

    if not course_id and source_course_id:
        course_id = source_course_id

    if not course_id:
        return 0

    course = fetch_one(
        "select price_per_hour, pricing_items from amilyhub.courses where source_course_id=%s",
        (course_id,),
    )
    if not course:
        return 0

    price_per_hour_cents = course.get("price_per_hour") or 0

    # Fallback: extract from pricing_items if price_per_hour is 0
    if price_per_hour_cents == 0:
        pricing_items = course.get("pricing_items") or []
        if pricing_items and isinstance(pricing_items, list):
            first_item = pricing_items[0]
            unit_price = float(first_item.get("price") or 0)
            price_per_hour_cents = int(unit_price * 100)

    if price_per_hour_cents == 0:
        return 0

    # Parse course hours from class_time_range (e.g., "09:00-10:00" → 1.0)
    course_hours = 1.0
    if class_time_range:
        import re as _re
        m = _re.search(r"(\d+):(\d+)-(\d+):(\d+)", str(class_time_range))
        if m:
            sh, sm, eh, em = int(m[1]), int(m[2]), int(m[3]), int(m[4])
            course_hours = (eh * 60 + em - sh * 60 - sm) / 60.0
            if course_hours <= 0:
                course_hours = 1.0

    return int(price_per_hour_cents * course_hours)


def assert_student_exists(source_student_id: str):
    row = fetch_one("select 1 as ok from amilyhub.students where source_student_id=%s", (source_student_id,))
    if not row:
        raise ApiError(422, "STUDENT_NOT_FOUND", "student not found for provided source_student_id")


def list_query(
    table: str,
    cols: str,
    clauses: list[str],
    params: list[Any],
    page: int,
    page_size: int,
    order_by: str = "id desc",
):
    page, page_size, offset = pager(page, page_size)
    cond = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.{table} {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select {cols}
        from amilyhub.{table}
        {cond}
        order by {order_by}
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {
        "ok": True,
        "data": rows,
        "page": {"page": page, "page_size": page_size, "total": total},
    }


@app.get("/api/v1/health")
def health():
    row = fetch_one("select now() as server_time")
    return {"ok": True, "server_time": row["server_time"] if row else None}


@app.get("/api/v1/rbac/roles", response_model=ListResponse)
def list_rbac_roles(request: Request):
    require_permission(request, "rbac:write")
    role_permissions = refresh_role_permissions(force=True)
    rows = [
        {"role": role, "permissions": sorted(list(permissions))}
        for role, permissions in sorted(role_permissions.items(), key=lambda item: item[0])
    ]
    return {"ok": True, "data": rows, "page": {"page": 1, "page_size": len(rows), "total": len(rows)}}


@app.put("/api/v1/rbac/roles/{role}", response_model=ObjectResponse)
def update_rbac_role(role: str, body: RbacRoleUpdateRequest, request: Request):
    ctx = require_permission(request, "rbac:write")
    role_name = (role or "").strip().lower()
    if not role_name:
        raise ApiError(422, "INVALID_ROLE", "角色名不能为空")

    unknown_permissions = sorted({x.strip() for x in body.permissions if x.strip() and x.strip() not in KNOWN_PERMISSIONS})
    if unknown_permissions:
        raise ApiError(422, "INVALID_PERMISSION", "存在未知权限点", details={"unknown_permissions": unknown_permissions})

    permissions = sorted({x.strip() for x in body.permissions if x.strip()})
    role_permissions = refresh_role_permissions(force=True)
    before_permissions = sorted(list(role_permissions.get(role_name, set())))
    ensure_rbac_role_permissions_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from amilyhub.rbac_role_permissions where role=%s", (role_name,))
            for permission in permissions:
                cur.execute(
                    """
                    insert into amilyhub.rbac_role_permissions(role, permission)
                    values (%s, %s)
                    """,
                    (role_name, permission),
                )
            conn.commit()

    refresh_role_permissions(force=True)
    before_set = set(before_permissions)
    after_set = set(permissions)
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="rbac.role_permissions.update",
        resource_type="rbac_role",
        resource_id=role_name,
        payload={
            "before": before_permissions,
            "after": permissions,
            "diff": {
                "added": sorted(list(after_set - before_set)),
                "removed": sorted(list(before_set - after_set)),
            },
        },
    )
    return {"ok": True, "data": {"role": role_name, "permissions": permissions}}


@app.get("/api/v1/audit-logs", response_model=ListResponse)
def list_audit_logs(
    request: Request,
    action: str | None = Query(default=None),
    operator: str | None = Query(default=None),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    require_permission(request, "audit:read")
    ensure_audit_logs_table()

    rows = fetch_audit_logs(action=action, operator=operator, start_time=start_time, end_time=end_time, limit=limit)
    return {"ok": True, "data": rows, "page": {"page": 1, "page_size": len(rows), "total": len(rows)}}


@app.get("/api/v1/audit-logs/export.csv")
def export_audit_logs_csv(
    request: Request,
    action: str | None = Query(default=None),
    operator: str | None = Query(default=None),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    require_permission(request, "audit:read")
    ensure_audit_logs_table()
    rows = fetch_audit_logs(action=action, operator=operator, start_time=start_time, end_time=end_time, limit=limit)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["created_at", "operator", "role", "action", "resource_type", "resource_id"])
    for row in rows:
        writer.writerow([
            row.get("created_at") or "",
            row.get("operator") or "",
            row.get("role") or "",
            row.get("action") or "",
            row.get("resource_type") or "",
            row.get("resource_id") or "",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )


@app.get("/api/v1/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary():
    base_student_where = "coalesce(name,'') not in ('Order Student','P0 Student') and position('测试' in coalesce(name,'')) = 0 and coalesce(phone,'') <> '' and coalesce(phone,'') <> '13900139000'"
    students = as_int(fetch_one(f"select count(*) as c from amilyhub.students where {base_student_where}")["c"])
    active_students = as_int(fetch_one(f"select count(*) as c from amilyhub.students where {base_student_where} and status in ('active','ACTIVE','在读','NORMAL','LEARNING')")["c"])
    teachers = as_int(fetch_one("select count(*) as c from amilyhub.teachers")["c"])
    orders = as_int(fetch_one("select count(*) as c from amilyhub.orders")["c"])
    hcf = as_int(fetch_one("select count(*) as c from amilyhub.hour_cost_flows")["c"])
    rollcalls = as_int(fetch_one("select count(*) as c from amilyhub.rollcalls")["c"])
    income_expense = as_int(fetch_one("select count(*) as c from amilyhub.income_expense")["c"])
    income = as_int(
        fetch_one(
            "select coalesce(sum(case when direction in ('收入','INCOME','IN') then amount_cents else 0 end),0) as s from amilyhub.income_expense"
        )["s"]
    )
    expense = as_int(
        fetch_one(
            "select coalesce(sum(case when direction in ('支出','EXPENSE','OUT') then amount_cents else 0 end),0) as s from amilyhub.income_expense"
        )["s"]
    )
    order_money = fetch_one(
        """
        select
          coalesce(sum(receivable_cents), 0) as receivable,
          coalesce(sum(received_cents), 0) as received,
          coalesce(sum(arrears_cents), 0) as arrears
        from amilyhub.orders
        """
    )
    return {
        "ok": True,
        "data": {
            "students": students,
            "active_students": active_students,
            "teachers": teachers,
            "orders": orders,
            "hour_cost_flows": hcf,
            "rollcalls": rollcalls,
            "income_expense": income_expense,
            "income_cents": income,
            "expense_cents": expense,
            "net_income_cents": income - expense,
            "receivable_cents": as_int(order_money["receivable"]),
            "received_cents": as_int(order_money["received"]),
            "arrears_cents": as_int(order_money["arrears"]),
        },
    }


@app.get("/api/v1/students", response_model=ListResponse)
def list_students(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    source: str | None = Query(default=None),
    age_range: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    # Audit fix: run migrations on first student list call
    ensure_new_tables()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [
        "coalesce(s.name,'') not in ('Order Student','P0 Student')",
        "position('测试' in coalesce(s.name,'')) = 0",
        "position('点名学生' in coalesce(s.name,'')) = 0",
        "position('Order Action' in coalesce(s.name,'')) = 0",
        "position('Renew Student' in coalesce(s.name,'')) = 0",
        "coalesce(s.phone,'') <> ''",
        "coalesce(s.phone,'') <> '13900139000'",
    ], []
    if q:
        clauses.append("(s.name ilike %s or s.phone ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if status:
        if status == "在读":
            clauses.append("s.status in ('在读','active','ACTIVE','NORMAL','LEARNING')")
        elif status == "结课":
            clauses.append("s.status in ('结课','HISTORY','GRADUATED')")
        elif status == "停课":
            clauses.append("s.status in ('停课','SUSPENDED','PAUSED')")
        else:
            clauses.append("s.status = %s")
            params.append(status)
    if source:
        clauses.append("s.source = %s")
        params.append(source)
    if age_range:
        # age_range format: "6-12" meaning age 6 to 12 inclusive
        parts = age_range.split("-")
        if len(parts) == 2:
            try:
                lo, hi = int(parts[0].strip()), int(parts[1].strip())
                clauses.append("extract(year from age(current_date, s.birthday))::int between %s and %s")
                params.extend([lo, hi])
            except ValueError:
                pass

    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(
        f"""
        select count(*) as c
        from amilyhub.students s
        {cond}
        """,
        tuple(params),
    )["c"]

    rows = fetch_rows(
        f"""
        with latest_hcf as (
          select distinct on (h.source_student_id)
            h.source_student_id,
            h.checked_at,
            coalesce(nullif(h.raw_json->>'className', ''), '-') as class_name
          from amilyhub.hour_cost_flows h
          where h.source_student_id is not null
          order by h.source_student_id, h.checked_at desc nulls last, h.id desc
        ), consumed as (
          select
            h.source_student_id,
            coalesce(sum(coalesce((h.raw_json->>'checkedPurchaseLessons')::numeric, 0) + coalesce((h.raw_json->>'checkedGiftLessons')::numeric, 0)), 0) as consumed_lessons
          from amilyhub.hour_cost_flows h
          where h.source_student_id is not null
          group by h.source_student_id
        ), purchased as (
          select
            o.source_student_id,
            coalesce(sum(
              coalesce(
                (regexp_match(coalesce(pi->>'itemsInfo', ''), '([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric,
                0
              )
            ), 0) as purchased_lessons
          from amilyhub.orders o
          left join lateral jsonb_array_elements(coalesce(o.raw_json->'purchaseItems', '[]'::jsonb)) as pi on true
          where o.source_student_id is not null
          group by o.source_student_id
        )
        select
          s.id,
          s.source_student_id,
          s.name,
          s.phone,
          s.gender,
          s.birthday,
          case when s.birthday is not null then extract(year from age(current_date, s.birthday))::int else null end as age,
          s.status,
          s.source_created_at,
          coalesce(nullif(s.raw_json->'studentSaleVO'->>'saleName', ''), '-') as consultant,
          coalesce(nullif(s.raw_json->>'createUserName', ''), '-') as creator,
          l.checked_at as latest_class_at,
          coalesce(l.class_name, '-') as class_name,
          greatest(coalesce(p.purchased_lessons, 0) - coalesce(c.consumed_lessons, 0), 0)::numeric as remain_hours,
          -- Audit fix: new student fields
          s.source as source,
          s.grade as grade,
          s.school as school,
          s.tags as tags,
          s.follow_up_person as follow_up_person,
          s.edu_manager as edu_manager,
          s.wechat_bound as wechat_bound,
          s.face_captured as face_captured
        from amilyhub.students s
        left join latest_hcf l on l.source_student_id = s.source_student_id
        left join consumed c on c.source_student_id = s.source_student_id
        left join purchased p on p.source_student_id = s.source_student_id
        {cond}
        order by s.id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )

    return {
        "ok": True,
        "data": rows,
        "page": {"page": page, "page_size": page_size, "total": total},
    }


@app.get("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def get_student(source_student_id: str):
    # Audit fix: run migrations to ensure new columns exist
    ensure_new_tables()
    row = fetch_one(
        """select id, source_student_id, name, phone, gender, birthday, status, source_created_at,
                  source, grade, school, tags, follow_up_person, edu_manager,
                  wechat_bound, face_captured
           from amilyhub.students where source_student_id=%s""",
        (source_student_id,),
    )
    if not row:
        raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
    return {"ok": True, "data": row}


@app.get("/api/v1/students/{source_student_id}/profile", response_model=ObjectResponse)
def get_student_profile(source_student_id: str):
    # Audit fix: run migrations to ensure new columns exist
    ensure_new_tables()
    student = fetch_one(
        """select id, source_student_id, name, phone, gender, birthday, status, source_created_at,
                  source, grade, school, tags, follow_up_person, edu_manager,
                  wechat_bound, face_captured
           from amilyhub.students
           where source_student_id=%s
        """,
        (source_student_id,),
    )
    if not student:
        raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")

    courses = fetch_rows(
        """
        with h as (
          select
            coalesce(raw_json->>'businessNo', '') as business_no,
            coalesce(sum(coalesce((raw_json->>'checkedPurchaseLessons')::numeric, 0)), 0) as consumed_purchase,
            coalesce(sum(coalesce((raw_json->>'checkedGiftLessons')::numeric, 0)), 0) as consumed_gift
          from amilyhub.hour_cost_flows
          where source_student_id=%s and coalesce(raw_json->>'businessNo', '') <> ''
          group by coalesce(raw_json->>'businessNo', '')
        )
        select
          o.source_order_id as order_no,
          coalesce(pi->>'itemsInfo', '-') as course_name,
          coalesce(o.order_state, '-') as order_state,
          coalesce(o.received_cents, 0) as paid_cents,
          coalesce(o.receivable_cents, 0) as receivable_cents,
          o.source_created_at,
          (
            case
              when coalesce(o.received_cents, 0) = 0 and position('送' in coalesce(pi->>'itemsInfo', '')) > 0 then 0
              else coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
            end
          )::numeric as purchased_lessons,
          (
            case
              when position('送一节' in coalesce(pi->>'itemsInfo', '')) > 0 then 1
              when coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0) > 0
                then coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
              when coalesce(o.received_cents, 0) > 0 and position('48节课时包' in coalesce(pi->>'itemsInfo', '')) > 0 then 3
              else 0
            end
          )::numeric as gift_lessons,
          (coalesce(h.consumed_purchase, 0) + coalesce(h.consumed_gift, 0))::numeric as consumed_lessons,
          0::numeric as transfer_lessons,
          greatest(
            (
              (
                case
                  when coalesce(o.received_cents, 0) = 0 and position('送' in coalesce(pi->>'itemsInfo', '')) > 0 then 0
                  else coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
                end
              )
              +
              case
                when position('送一节' in coalesce(pi->>'itemsInfo', '')) > 0 then 1
                when coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0) > 0
                  then coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
                when coalesce(o.received_cents, 0) > 0 and position('48节课时包' in coalesce(pi->>'itemsInfo', '')) > 0 then 3
                else 0
              end
              -
              (coalesce(h.consumed_purchase, 0) + coalesce(h.consumed_gift, 0))
            ),
            0
          )::numeric as remain_lessons
        from amilyhub.orders o
        left join lateral jsonb_array_elements(coalesce(o.raw_json->'purchaseItems', '[]'::jsonb)) pi on true
        left join h on h.business_no = o.source_order_id
        where o.source_student_id=%s
        order by o.source_order_id desc
        limit 50
        """,
        (source_student_id, source_student_id),
    )

    consumption = fetch_rows(
        """
        select
          h.source_id,
          coalesce(nullif(h.raw_json->>'className', ''), '-') as class_name,
          coalesce(nullif(h.raw_json->>'courseName', ''), '-') as course_name,
          coalesce(nullif(h.raw_json->>'teacherNames', ''), '-') as teacher_names,
          coalesce(h.raw_json->>'businessNo', '-') as order_no,
          coalesce((h.raw_json->>'checkedPurchaseLessons')::numeric, 0) + coalesce((h.raw_json->>'checkedGiftLessons')::numeric, 0) as consumed_lessons,
          h.checked_at
        from amilyhub.hour_cost_flows h
        where h.source_student_id=%s
        order by h.checked_at desc nulls last, h.id desc
        limit 100
        """,
        (source_student_id,),
    )

    rollcalls = fetch_rows(
        """
        select
          source_row_hash,
          class_name,
          course_name,
          teacher_name,
          rollcall_time,
          status
        from amilyhub.rollcalls
        where coalesce(raw_json->>'studentId','')=%s
           or coalesce(raw_json->>'studentName','')=coalesce(%s,'')
        order by id desc
        limit 50
        """,
        (source_student_id, student.get('name')),
    )

    payments = fetch_rows(
        """
        select
          ie.source_id,
          ie.source_order_id,
          ie.item_type,
          ie.direction,
          ie.amount_cents,
          ie.operation_date,
          ie.source_created_at
        from amilyhub.income_expense ie
        where ie.source_order_id in (
          select o.source_order_id from amilyhub.orders o where o.source_student_id=%s
        )
           or coalesce(ie.raw_json->>'studentId','')=%s
        order by ie.id desc
        limit 100
        """,
        (source_student_id, source_student_id),
    )

    order_logs = fetch_rows(
        """
        select
          o.source_order_id as order_no,
          coalesce(pi->>'itemsInfo', '-') as item_info,
          coalesce(o.receivable_cents, 0) as receivable_cents,
          coalesce(o.received_cents, 0) as received_cents,
          coalesce(o.order_state, '-') as order_state,
          coalesce(o.raw_json->>'businessType', '-') as business_type,
          coalesce(o.raw_json->>'creatorName', '-') as owner_name,
          to_timestamp(nullif(o.raw_json->>'created', '')::bigint / 1000.0) as created_at,
          to_timestamp(nullif(o.raw_json->>'lastPaymentTime', '')::bigint / 1000.0) as paid_at
        from amilyhub.orders o
        left join lateral jsonb_array_elements(coalesce(o.raw_json->'purchaseItems', '[]'::jsonb)) pi on true
        where o.source_student_id=%s
        order by o.source_order_id desc
        limit 100
        """,
        (source_student_id,),
    )

    return {
        "ok": True,
        "data": {
            "student": student,
            "courses": courses,
            "consumption": consumption,
            "rollcalls": rollcalls,
            "payments": payments,
            "order_logs": order_logs,
        },
    }


@app.post("/api/v1/students", response_model=ObjectResponse, status_code=201)
def create_student(payload: StudentUpsertRequest):
    # Audit fix: run migrations to ensure new columns exist
    ensure_new_tables()
    with get_conn() as conn:
        with conn.cursor() as cur:
            source_student_id = payload.source_student_id
            if source_student_id:
                cur.execute("select 1 from amilyhub.students where source_student_id=%s", (source_student_id,))
                if cur.fetchone():
                    raise ApiError(409, "STUDENT_EXISTS", "student already exists")
            else:
                for _ in range(10):
                    candidate = generate_student_id()
                    cur.execute("select 1 from amilyhub.students where source_student_id=%s", (candidate,))
                    if not cur.fetchone():
                        source_student_id = candidate
                        break
                if not source_student_id:
                    raise ApiError(500, "STUDENT_ID_GENERATE_FAILED", "failed to generate student id")

            if payload.name and payload.phone:
                cur.execute(
                    """
                    select source_student_id from amilyhub.students
                    where lower(coalesce(name, '')) = lower(%s)
                      and coalesce(phone, '') = %s
                    limit 1
                    """,
                    (payload.name, payload.phone),
                )
                hit = cur.fetchone()
                if hit:
                    raise ApiError(409, "STUDENT_EXISTS", f"student already exists: {hit[0]}")

            # Audit fix: include new student fields in INSERT
            cur.execute(
                """
                insert into amilyhub.students
                (source_student_id, name, phone, gender, birthday, status, source, grade, school, tags,
                 follow_up_person, edu_manager, wechat_bound, face_captured, raw_json)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                returning id, source_student_id, name, phone, gender, birthday, status, source_created_at,
                          source, grade, school, tags, follow_up_person, edu_manager, wechat_bound, face_captured
                """,
                (
                    source_student_id,
                    payload.name,
                    payload.phone,
                    payload.gender,
                    payload.birthday,
                    payload.status or "在读",
                    payload.source,
                    payload.grade,
                    payload.school,
                    payload.tags,
                    payload.follow_up_person,
                    payload.edu_manager,
                    payload.wechat_bound if payload.wechat_bound is not None else False,
                    payload.face_captured if payload.face_captured is not None else False,
                    json.dumps({**payload.model_dump(mode="json"), "source_student_id": source_student_id, "status": payload.status or "在读"}, ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.put("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def update_student(source_student_id: str, payload: StudentUpdateRequest):
    # Audit fix: run migrations and handle new student fields
    ensure_new_tables()
    updates = payload.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")

    # Audit fix: handle tags specially (list -> PostgreSQL TEXT[] array literal)
    tags_val = updates.pop("tags", None)
    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
    if tags_val is not None:
        # Format as PostgreSQL array literal: ARRAY['a','b']::text[]
        items = ",".join(f"'{str(t).replace('\'', '\'\'')}'" for t in tags_val)
        set_parts.append(f"tags=ARRAY[{items}]::text[]")
    set_parts.append("raw_json=%s::jsonb")
    values.append(json.dumps(updates, ensure_ascii=False, default=str))
    values.append(source_student_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                update amilyhub.students
                set {', '.join(set_parts)}
                where source_student_id=%s
                returning id, source_student_id, name, phone, gender, birthday, status, source_created_at,
                          source, grade, school, tags, follow_up_person, edu_manager, wechat_bound, face_captured
                """,
                tuple(values),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.delete("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def delete_student(source_student_id: str, cascade: bool = Query(default=False)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.students where source_student_id=%s", (source_student_id,))
            if not cur.fetchone():
                raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")

            cur.execute("select count(*) from amilyhub.orders where source_student_id=%s", (source_student_id,))
            order_cnt = int((cur.fetchone() or [0])[0] or 0)
            cur.execute("select count(*) from amilyhub.hour_cost_flows where source_student_id=%s", (source_student_id,))
            flow_cnt = int((cur.fetchone() or [0])[0] or 0)

            if (order_cnt > 0 or flow_cnt > 0) and not cascade:
                raise ApiError(409, "STUDENT_HAS_REFS", f"student has related orders/flows: {order_cnt}/{flow_cnt}")

            if cascade:
                cur.execute("delete from amilyhub.orders where source_student_id=%s", (source_student_id,))
                cur.execute("delete from amilyhub.hour_cost_flows where source_student_id=%s", (source_student_id,))

            cur.execute("delete from amilyhub.students where source_student_id=%s", (source_student_id,))
            conn.commit()

    return {"ok": True, "data": {"source_student_id": source_student_id, "cascade": cascade}}


@app.post("/api/v1/students/{source_student_id}/enroll", response_model=ObjectResponse, status_code=201)
def enroll_student(source_student_id: str, payload: EnrollmentRequest):
    assert_student_exists(source_student_id)
    source_order_id = f"ODR{int(time.time() * 1000)}{random.randint(100,999)}"
    raw_json = {
        "source_order_id": source_order_id,
        "courseName": payload.course_name,
        "purchaseItems": [{"itemsInfo": payload.course_name}],
        "orderType": payload.order_type,
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into amilyhub.orders
                (source_order_id, source_student_id, order_type, order_state, receivable_cents, received_cents, arrears_cents, raw_json)
                values (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                returning id, source_order_id, source_student_id, order_type, order_state,
                          receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
                """,
                (
                    source_order_id,
                    source_student_id,
                    payload.order_type,
                    "已支付" if payload.arrears_cents == 0 else "待支付",
                    payload.receivable_cents,
                    payload.received_cents,
                    payload.arrears_cents,
                    json.dumps(raw_json, ensure_ascii=False),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.get("/api/v1/teachers", response_model=ListResponse)
def list_teachers(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append("(name ilike %s or phone ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if status:
        clauses.append("coalesce(nullif(raw_json->>'status',''),'在职') = %s")
        params.append(normalize_teacher_status(status))
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.teachers {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select
          id,
          source_teacher_id,
          name,
          phone,
          gender,
          last_month_lessons,
          current_month_lessons,
          total_finished_lessons,
          coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
          coalesce(nullif(raw_json->>'status',''),'在职') as status
        from amilyhub.teachers
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


@app.post("/api/v1/teachers", response_model=ObjectResponse, status_code=201)
def create_teacher(payload: TeacherCreateRequest, request: Request):
    ctx = require_permission(request, "teachers:write")
    source_teacher_id = (payload.source_teacher_id or "").strip() or generate_teacher_id()
    subjects = normalize_subjects(payload.subjects)
    status = normalize_teacher_status(payload.status)
    raw_json = {
        "source_teacher_id": source_teacher_id,
        "name": payload.name,
        "phone": payload.phone,
        "subjects": subjects,
        "status": status,
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.teachers where source_teacher_id=%s", (source_teacher_id,))
            if cur.fetchone():
                raise ApiError(409, "TEACHER_EXISTS", "teacher already exists")
            cur.execute(
                """
                insert into amilyhub.teachers(source_teacher_id, name, phone, raw_json)
                values (%s, %s, %s, %s::jsonb)
                returning id, source_teacher_id, name, phone,
                          coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                          coalesce(nullif(raw_json->>'status',''),'在职') as status
                """,
                (source_teacher_id, payload.name, payload.phone, json.dumps(raw_json, ensure_ascii=False)),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.create",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"request": payload.model_dump(mode="json"), "result": data},
    )
    return {"ok": True, "data": data}


@app.put("/api/v1/teachers/{source_teacher_id}", response_model=ObjectResponse)
def update_teacher(source_teacher_id: str, payload: TeacherUpdateRequest, request: Request):
    ctx = require_permission(request, "teachers:write")
    updates = payload.model_dump(mode="json", exclude_none=True)
    if "status" in updates:
        updates["status"] = normalize_teacher_status(updates["status"])
    if "subjects" in updates:
        updates["subjects"] = normalize_subjects(updates["subjects"])
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select source_teacher_id, name, phone, coalesce(raw_json, '{}'::jsonb) as raw_json
                from amilyhub.teachers
                where source_teacher_id=%s
                """,
                (source_teacher_id,),
            )
            found = cur.fetchone()
            if not found:
                raise ApiError(404, "TEACHER_NOT_FOUND", "teacher not found")
            found_cols = [d.name for d in cur.description]
            current = dict(zip(found_cols, found))

            next_name = updates.get("name", current.get("name"))
            next_phone = updates.get("phone", current.get("phone"))
            raw_patch = {**updates, "source_teacher_id": source_teacher_id, "name": next_name, "phone": next_phone}
            cur.execute(
                """
                update amilyhub.teachers
                set
                  name=%s,
                  phone=%s,
                  raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_teacher_id=%s
                returning id, source_teacher_id, name, phone,
                          coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                          coalesce(nullif(raw_json->>'status',''),'在职') as status
                """,
                (next_name, next_phone, json.dumps(raw_patch, ensure_ascii=False), source_teacher_id),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.update",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"request": updates, "result": data},
    )
    return {"ok": True, "data": data}


@app.patch("/api/v1/teachers/{source_teacher_id}/status", response_model=ObjectResponse)
def update_teacher_status(source_teacher_id: str, payload: TeacherStatusUpdateRequest, request: Request):
    ctx = require_permission(request, "teachers:write")
    status = normalize_teacher_status(payload.status)
    raw_patch = {"status": status}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update amilyhub.teachers
                set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_teacher_id=%s
                returning id, source_teacher_id, name, phone,
                          coalesce(raw_json->'subjects', '[]'::jsonb) as subjects,
                          coalesce(nullif(raw_json->>'status',''),'在职') as status
                """,
                (json.dumps(raw_patch, ensure_ascii=False), source_teacher_id),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "TEACHER_NOT_FOUND", "teacher not found")
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="teachers.status_change",
        resource_type="teacher",
        resource_id=source_teacher_id,
        payload={"status": status, "result": data},
    )
    return {"ok": True, "data": data}


@app.get("/api/v1/orders", response_model=ListResponse)
def list_orders(
    student_id: str | None = Query(default=None),
    state: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if student_id:
        clauses.append("o.source_student_id = %s")
        params.append(student_id)
    if state:
        clauses.append("o.order_state = %s")
        params.append(state)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(
        f"""
        select count(*) as c
        from amilyhub.orders o
        {cond}
        """,
        tuple(params),
    )["c"]

    rows = fetch_rows(
        f"""
        select
          o.id,
          o.source_order_id,
          o.source_student_id,
          coalesce(s.name, '-') as student_name,
          o.order_type,
          o.order_state,
          o.receivable_cents,
          o.received_cents,
          o.arrears_cents,
          o.source_created_at,
          o.source_paid_at
        from amilyhub.orders o
        left join amilyhub.students s on s.source_student_id = o.source_student_id
        {cond}
        order by o.id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


@app.get("/api/v1/orders/{source_order_id}", response_model=ObjectResponse)
def get_order(source_order_id: str):
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
    return {"ok": True, "data": row}


@app.post("/api/v1/orders", response_model=ObjectResponse, status_code=201)
def create_order(payload: OrderUpsertRequest):
    ensure_order_events_table()
    if payload.source_student_id:
        assert_student_exists(payload.source_student_id)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.orders where source_order_id=%s", (payload.source_order_id,))
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
                    payload.source_order_id,
                    payload.source_student_id,
                    payload.order_type,
                    payload.order_state,
                    payload.receivable_cents,
                    payload.received_cents,
                    payload.arrears_cents,
                    json.dumps(payload.model_dump(mode="json"), ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            create_order_event(cur, payload.source_order_id, "create", payload.model_dump(mode="json"))
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.post("/api/v1/orders/renewal", response_model=ObjectResponse, status_code=201)
def create_order_renewal(payload: OrderRenewalRequest, request: Request):
    ctx = require_permission(request, "orders:write")
    ensure_order_events_table()
    assert_student_exists(payload.source_student_id)
    source_order_id = f"RNEW{int(time.time() * 1000)}{random.randint(100,999)}"
    order_state = "已支付" if payload.arrears_cents == 0 else "待支付"
    raw = payload.model_dump(mode="json")
    raw["source_order_id"] = source_order_id
    raw["order_type"] = "续费"
    with get_conn() as conn:
        with conn.cursor() as cur:
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
                    payload.source_student_id,
                    "续费",
                    order_state,
                    payload.receivable_cents,
                    payload.received_cents,
                    payload.arrears_cents,
                    json.dumps(raw, ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            create_order_event(cur, source_order_id, "renewal", raw)
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="orders.renewal",
        resource_type="order",
        resource_id=source_order_id,
        payload={"request": raw, "result": data},
    )
    return {"ok": True, "data": data}


@app.put("/api/v1/orders/{source_order_id}", response_model=ObjectResponse)
def update_order(source_order_id: str, payload: OrderUpdateRequest):
    updates = payload.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")
    if updates.get("source_student_id"):
        assert_student_exists(updates["source_student_id"])

    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
    set_parts.append("raw_json=%s::jsonb")
    values.append(json.dumps(updates, ensure_ascii=False, default=str))
    values.append(source_order_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
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
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.post("/api/v1/orders/{source_order_id}/void", response_model=ObjectResponse)
def void_order(source_order_id: str, request: Request, payload: OrderActionRequest | None = None):
    ctx = require_permission(request, "orders:write")
    ensure_order_events_table()
    operator = (payload.operator if payload else None) or "system"
    reason = (payload.reason if payload else None) or "manual_void"
    event_payload = {
        "source_order_id": source_order_id,
        "operator": operator,
        "reason": reason,
        "action": "void",
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update amilyhub.orders
                set order_state=%s,
                    raw_json = coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_order_id=%s
                returning id, source_order_id, source_student_id, order_type, order_state,
                          receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at
                """,
                (
                    "已作废",
                    json.dumps({"voided": True, "void_reason": reason, "void_operator": operator}, ensure_ascii=False),
                    source_order_id,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
            cols = [d.name for d in cur.description]
            if not has_order_event(cur, source_order_id, "void"):
                create_order_event(cur, source_order_id, "void", event_payload, operator=operator, reason=reason)
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="orders.void",
        resource_type="order",
        resource_id=source_order_id,
        payload={"request": event_payload, "result": data},
    )
    return {"ok": True, "data": data}


@app.post("/api/v1/orders/{source_order_id}/refund", response_model=ObjectResponse)
def refund_order(source_order_id: str, request: Request, payload: OrderActionRequest | None = None):
    ctx = require_permission(request, "orders:write")
    ensure_order_events_table()
    operator = (payload.operator if payload else None) or "system"
    reason = (payload.reason if payload else None) or "manual_refund"
    event_payload = {
        "source_order_id": source_order_id,
        "operator": operator,
        "reason": reason,
        "action": "refund",
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update amilyhub.orders
                set order_type=%s,
                    order_state=%s,
                    raw_json = coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_order_id=%s
                returning id, source_order_id, source_student_id, order_type, order_state,
                          receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at,
                          coalesce(raw_json, '{}'::jsonb) as raw_json
                """,
                (
                    "退费",
                    "已作废",
                    json.dumps({"refunded": True, "refund_reason": reason, "refund_operator": operator}, ensure_ascii=False),
                    source_order_id,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "ORDER_NOT_FOUND", "order not found")
            cols = [d.name for d in cur.description]
            data = dict(zip(cols, row))

            if not has_order_event(cur, source_order_id, "refund"):
                create_order_event(cur, source_order_id, "refund", event_payload, operator=operator, reason=reason)

            # Create income_expense record for the refund (支出: 退费)
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
                    (
                        expense_source_id,
                        source_order_id,
                        "退费",
                        "支出",
                        refund_amount,
                        date.today(),
                        json.dumps(expense_raw, ensure_ascii=False, default=str),
                    ),
                )

            conn.commit()
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="orders.refund",
        resource_type="order",
        resource_id=source_order_id,
        payload={"request": event_payload, "result": data},
    )
    return {"ok": True, "data": data}


@app.get("/api/v1/hour-cost-flows", response_model=ListResponse)
def list_hour_cost_flows(
    student_id: str | None = Query(default=None),
    teacher_id: str | None = Query(default=None),
    cost_type: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    checked_from: date | None = Query(default=None),
    checked_to: date | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    clauses, params = [], []
    if student_id:
        clauses.append("source_student_id = %s")
        params.append(student_id)
    if teacher_id:
        clauses.append("source_teacher_id = %s")
        params.append(teacher_id)
    if cost_type:
        clauses.append("cost_type = %s")
        params.append(cost_type)
    if source_type:
        clauses.append("source_type = %s")
        params.append(source_type)
    if checked_from:
        clauses.append("checked_at::date >= %s")
        params.append(checked_from)
    if checked_to:
        clauses.append("checked_at::date <= %s")
        params.append(checked_to)
    return list_query(
        "hour_cost_flows",
        "id, source_id, source_student_id, source_teacher_id, source_class_id, source_course_id, cost_type, source_type, cost_hours, cost_amount_cents, checked_at, source_created_at",
        clauses,
        params,
        page,
        page_size,
    )


@app.post("/api/v1/income-expense", response_model=ObjectResponse, status_code=201)
def create_income_expense(payload: IncomeExpenseCreateRequest, request: Request):
    ctx = require_permission(request, "finance:write")
    source_record_id = (payload.source_record_id or "").strip() or generate_income_expense_id()
    direction = normalize_direction(payload.direction)
    status = normalize_record_status(payload.status)
    raw_json = {
        "source_record_id": source_record_id,
        "payment_method": payload.payment_method,
        "operator": payload.operator,
        "remark": payload.remark,
        "status": status,
    }
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.income_expense where source_id=%s", (source_record_id,))
            if cur.fetchone():
                raise ApiError(409, "INCOME_EXPENSE_EXISTS", "income_expense record already exists")
            cur.execute(
                """
                insert into amilyhub.income_expense
                (source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at, raw_json)
                values (%s, %s, %s, %s, %s, %s, now(), %s::jsonb)
                returning
                  id,
                  source_id as source_record_id,
                  source_id,
                  source_order_id,
                  item_type,
                  direction,
                  amount_cents,
                  operation_date,
                  source_created_at,
                  coalesce(raw_json->>'payment_method', '-') as payment_method,
                  coalesce(raw_json->>'operator', '-') as operator,
                  coalesce(raw_json->>'remark', '') as remark,
                  coalesce(nullif(raw_json->>'status',''),'正常') as status
                """,
                (
                    source_record_id,
                    payload.source_order_id,
                    payload.item_type,
                    direction,
                    payload.amount_cents,
                    payload.operation_date,
                    json.dumps(raw_json, ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="finance.create",
        resource_type="income_expense",
        resource_id=source_record_id,
        payload={"request": payload.model_dump(mode="json"), "result": data},
    )
    return {"ok": True, "data": data}


@app.put("/api/v1/income-expense/{source_record_id}", response_model=ObjectResponse)
def update_income_expense(source_record_id: str, payload: IncomeExpenseUpdateRequest, request: Request):
    ctx = require_permission(request, "finance:write")
    updates = payload.model_dump(mode="json", exclude_none=True)
    if "direction" in updates:
        updates["direction"] = normalize_direction(updates["direction"])
    if "status" in updates:
        updates["status"] = normalize_record_status(updates["status"])
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  source_id,
                  source_order_id,
                  item_type,
                  direction,
                  amount_cents,
                  operation_date,
                  coalesce(raw_json, '{}'::jsonb) as raw_json
                from amilyhub.income_expense
                where source_id=%s
                """,
                (source_record_id,),
            )
            found = cur.fetchone()
            if not found:
                raise ApiError(404, "INCOME_EXPENSE_NOT_FOUND", "income_expense record not found")
            found_cols = [d.name for d in cur.description]
            current = dict(zip(found_cols, found))

            next_source_order_id = updates.get("source_order_id", current.get("source_order_id"))
            next_item_type = updates.get("item_type", current.get("item_type"))
            next_direction = updates.get("direction", current.get("direction"))
            next_amount_cents = updates.get("amount_cents", current.get("amount_cents"))
            next_operation_date = updates.get("operation_date", current.get("operation_date"))
            raw_patch: dict[str, Any] = {}
            if "payment_method" in updates:
                raw_patch["payment_method"] = updates["payment_method"]
            if "operator" in updates:
                raw_patch["operator"] = updates["operator"]
            if "remark" in updates:
                raw_patch["remark"] = updates["remark"]
            if "status" in updates:
                raw_patch["status"] = updates["status"]

            cur.execute(
                """
                update amilyhub.income_expense
                set
                  source_order_id=%s,
                  item_type=%s,
                  direction=%s,
                  amount_cents=%s,
                  operation_date=%s,
                  raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_id=%s
                returning
                  id,
                  source_id as source_record_id,
                  source_id,
                  source_order_id,
                  item_type,
                  direction,
                  amount_cents,
                  operation_date,
                  source_created_at,
                  coalesce(raw_json->>'payment_method', '-') as payment_method,
                  coalesce(raw_json->>'operator', '-') as operator,
                  coalesce(raw_json->>'remark', '') as remark,
                  coalesce(nullif(raw_json->>'status',''),'正常') as status
                """,
                (
                    next_source_order_id,
                    next_item_type,
                    next_direction,
                    next_amount_cents,
                    next_operation_date,
                    json.dumps(raw_patch, ensure_ascii=False, default=str),
                    source_record_id,
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="finance.update",
        resource_type="income_expense",
        resource_id=source_record_id,
        payload={"request": updates, "result": data},
    )
    return {"ok": True, "data": data}


@app.post("/api/v1/income-expense/{source_record_id}/void", response_model=ObjectResponse)
def void_income_expense(source_record_id: str, request: Request, payload: IncomeExpenseVoidRequest | None = None):
    ctx = require_permission(request, "finance:write")
    operator = ((payload.operator if payload else None) or "system").strip() or "system"
    reason = ((payload.reason if payload else None) or "manual_void").strip() or "manual_void"
    raw_patch = {"status": "作废", "void_operator": operator, "void_reason": reason}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update amilyhub.income_expense
                set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb
                where source_id=%s
                returning
                  id,
                  source_id as source_record_id,
                  source_id,
                  source_order_id,
                  item_type,
                  direction,
                  amount_cents,
                  operation_date,
                  source_created_at,
                  coalesce(raw_json->>'payment_method', '-') as payment_method,
                  coalesce(raw_json->>'operator', '-') as operator,
                  coalesce(raw_json->>'remark', '') as remark,
                  coalesce(nullif(raw_json->>'status',''),'正常') as status
                """,
                (json.dumps(raw_patch, ensure_ascii=False), source_record_id),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "INCOME_EXPENSE_NOT_FOUND", "income_expense record not found")
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="finance.void",
        resource_type="income_expense",
        resource_id=source_record_id,
        payload={"operator": operator, "reason": reason, "result": data},
    )
    return {"ok": True, "data": data}


@app.get("/api/v1/income-expense", response_model=ListResponse)
def list_income_expense(
    q: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    operation_date_from: date | None = Query(default=None),
    operation_date_to: date | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append(
            "(source_id ilike %s or coalesce(item_type,'') ilike %s or coalesce(raw_json->>'operator','') ilike %s or coalesce(raw_json->>'remark','') ilike %s)"
        )
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
    if direction:
        clauses.append("direction = %s")
        params.append(normalize_direction(direction))
    if item_type:
        clauses.append("item_type = %s")
        params.append(item_type)
    if status:
        clauses.append("coalesce(nullif(raw_json->>'status',''),'正常') = %s")
        params.append(normalize_record_status(status))
    if payment_method:
        clauses.append("coalesce(nullif(raw_json->>'payment_method',''),'-') = %s")
        params.append(payment_method)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    return list_query(
        "income_expense",
        """
        id,
        source_id as source_record_id,
        source_id,
        source_order_id,
        item_type,
        direction,
        amount_cents,
        operation_date,
        source_created_at,
        coalesce(raw_json->>'payment_method', '-') as payment_method,
        coalesce(raw_json->>'operator', '-') as operator,
        coalesce(raw_json->>'remark', '') as remark,
        coalesce(nullif(raw_json->>'status',''),'正常') as status
        """,
        clauses,
        params,
        page,
        page_size,
    )


@app.get("/api/v1/income-expense/summary", response_model=IncomeExpenseSummaryResponse)
def income_expense_summary(
    direction: str | None = Query(default=None),
    operation_date_from: date | None = Query(default=None),
    operation_date_to: date | None = Query(default=None),
):
    clauses, params = [], []
    if direction:
        clauses.append("direction = %s")
        params.append(direction)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    cond = f" where {' and '.join(clauses)} " if clauses else ""
    row = fetch_one(
        f"""
        select
          count(*) as total_count,
          coalesce(sum(case when direction in ('收入','INCOME','IN') then amount_cents else 0 end),0) as income_cents,
          coalesce(sum(case when direction in ('支出','EXPENSE','OUT') then amount_cents else 0 end),0) as expense_cents
        from amilyhub.income_expense
        {cond}
        """,
        tuple(params),
    )
    income_cents = as_int(row["income_cents"])
    expense_cents = as_int(row["expense_cents"])
    return {
        "ok": True,
        "data": {
            "total_count": as_int(row["total_count"]),
            "income_cents": income_cents,
            "expense_cents": expense_cents,
            "net_income_cents": income_cents - expense_cents,
        },
    }


@app.get("/api/v1/income-expense/export")
def export_income_expense(
    q: str | None = Query(default=None),
    direction: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    operation_date_from: date | None = Query(default=None),
    operation_date_to: date | None = Query(default=None),
):
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append(
            "(source_id ilike %s or coalesce(item_type,'') ilike %s or coalesce(raw_json->>'operator','') ilike %s or coalesce(raw_json->>'remark','') ilike %s)"
        )
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
    if direction:
        clauses.append("direction = %s")
        params.append(normalize_direction(direction))
    if item_type:
        clauses.append("item_type = %s")
        params.append(item_type)
    if status:
        clauses.append("coalesce(nullif(raw_json->>'status',''),'正常') = %s")
        params.append(normalize_record_status(status))
    if payment_method:
        clauses.append("coalesce(nullif(raw_json->>'payment_method',''),'-') = %s")
        params.append(payment_method)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    cond = f" where {' and '.join(clauses)} " if clauses else ""
    rows = fetch_rows(
        f"""
        select
          source_id,
          source_order_id,
          item_type,
          direction,
          amount_cents,
          operation_date,
          source_created_at,
          coalesce(raw_json->>'payment_method', '-') as payment_method,
          coalesce(raw_json->>'operator', '-') as operator,
          coalesce(raw_json->>'remark', '') as remark,
          coalesce(nullif(raw_json->>'status',''),'正常') as status
        from amilyhub.income_expense
        {cond}
        order by operation_date desc, source_id desc
        limit 10000
        """,
        tuple(params),
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "编号", "订单号", "收支类型", "方向", "金额(元)", "操作日期",
        "支付方式", "经手人", "备注", "状态",
    ])
    for r in rows:
        amount_yuan = (r.get("amount_cents") or 0) / 100.0
        writer.writerow([
            r.get("source_id", ""),
            r.get("source_order_id", ""),
            r.get("item_type", ""),
            r.get("direction", ""),
            f"{amount_yuan:.2f}",
            r.get("operation_date", ""),
            r.get("payment_method", "-"),
            r.get("operator", "-"),
            r.get("remark", ""),
            r.get("status", "正常"),
        ])
    csv_content = output.getvalue()
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=income_expense.csv"},
    )


@app.get("/api/v1/courses", response_model=ListResponse)
def list_courses(
    q: str | None = Query(default=None),
    course_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    ensure_new_tables()
    ensure_courses_table()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if q:
        clauses.append("name ilike %s")
        params.append(f"%{q}%")
    if course_type:
        clauses.append("course_type = %s")
        params.append(course_type)
    if status:
        clauses.append("status = %s")
        params.append(status)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.courses {cond}", tuple(params))
    rows = fetch_rows(
        f"""
        select
          id,
          coalesce(name,'-') as course_name,
          coalesce(course_type,'一对多') as course_type,
          coalesce(fee_type,'按课时') as charge_type,
          coalesce(pricing_rules,'-') as pricing_rules,
          coalesce(pricing_items,'[]'::jsonb) as pricing_items,
          coalesce(student_num,0) as active_students,
          coalesce(status,'启用') as status,
          -- Audit fix: new course fields
          coalesce(validity_days,0) as validity_days,
          coalesce(description,'') as description,
          coalesce(materials,'{{}}'::text[]) as materials
        from amilyhub.courses
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": int((total or {}).get('c', 0) or 0)}}


@app.post("/api/v1/courses", response_model=ObjectResponse, status_code=201)
def create_course(payload: CourseUpsertRequest):
    # Audit fix: run migrations to add validity_days, description, materials columns
    ensure_new_tables()
    ensure_courses_table()
    src = payload.source_course_id or f"LOCAL_{int(time.time()*1000)}_{random.randint(100,999)}"
    pricing_items = normalize_pricing_items(payload.pricing_items)
    pricing_rules = pricing_items_to_text(pricing_items) if pricing_items else (payload.pricing_rules or "-")
    raw = payload.model_dump(mode="json")
    raw["pricing_items"] = pricing_items
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Audit fix: include validity_days, description, materials in INSERT
            cur.execute(
                """
                insert into amilyhub.courses(
                  source_course_id, name, course_type, fee_type, status,
                  pricing_rules, pricing_items, student_num,
                  validity_days, description, materials,
                  raw_source_json, raw_json
                )
                values (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb)
                returning id, source_course_id, name, course_type, fee_type, status,
                          pricing_rules, student_num, validity_days, description, materials
                """,
                (
                    src,
                    payload.name,
                    payload.course_type,
                    payload.fee_type,
                    payload.status,
                    pricing_rules,
                    json.dumps(pricing_items, ensure_ascii=False),
                    payload.student_num,
                    payload.validity_days,
                    payload.description,
                    payload.materials,
                    "null",
                    json.dumps(raw, ensure_ascii=False),
                ),
            )
            row = cur.fetchone(); cols=[d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols,row))}


@app.put("/api/v1/courses/{course_id}", response_model=ObjectResponse)
def update_course(course_id: str, payload: CourseUpsertRequest):
    # Audit fix: run migrations to add validity_days, description, materials columns
    ensure_new_tables()
    ensure_courses_table()
    pricing_items = normalize_pricing_items(payload.pricing_items)
    pricing_rules = pricing_items_to_text(pricing_items) if pricing_items else (payload.pricing_rules or "-")
    raw = payload.model_dump(mode="json")
    raw["pricing_items"] = pricing_items
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Audit fix: include validity_days, description, materials in UPDATE
            cur.execute(
                """
                update amilyhub.courses
                set
                  name=%s,
                  course_type=%s,
                  fee_type=%s,
                  status=%s,
                  pricing_rules=%s,
                  pricing_items=%s::jsonb,
                  student_num=%s,
                  validity_days=%s,
                  description=%s,
                  materials=%s,
                  raw_json=%s::jsonb,
                  updated_at=now()
                where id=%s
                returning id, source_course_id, name, course_type, fee_type, status,
                          pricing_rules, student_num, validity_days, description, materials
                """,
                (
                    payload.name,
                    payload.course_type,
                    payload.fee_type,
                    payload.status,
                    pricing_rules,
                    json.dumps(pricing_items, ensure_ascii=False),
                    payload.student_num,
                    payload.validity_days,
                    payload.description,
                    payload.materials,
                    json.dumps(raw, ensure_ascii=False),
                    int(course_id),
                ),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "COURSE_NOT_FOUND", "course not found")
            cols=[d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols,row))}


@app.delete("/api/v1/courses/{course_id}", response_model=ObjectResponse)
def delete_course(course_id: str):
    ensure_courses_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from amilyhub.courses where id=%s returning id", (int(course_id),))
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "COURSE_NOT_FOUND", "course not found")
            conn.commit()
    return {"ok": True, "data": {"id": int(course_id)}}


# ── Rooms ────────────────────────────────────────────────────────────────────

class RoomCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    campus: str = ""
    capacity: int = Field(default=0, ge=0)
    status: str = "active"


class RoomUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    campus: str | None = None
    capacity: int | None = Field(default=None, ge=0)
    status: str | None = None


@app.get("/api/v1/rooms", response_model=ListResponse)
def list_rooms(
    q: str | None = Query(default=None),
    campus: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    ensure_rooms_table()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if q:
        clauses.append("name ilike %s")
        params.append(f"%{q}%")
    if campus:
        clauses.append("campus = %s")
        params.append(campus)
    if status:
        clauses.append("status = %s")
        params.append(status)
    cond = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.rooms {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select id, name, campus, capacity, status, created_at, updated_at
        from amilyhub.rooms
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


@app.post("/api/v1/rooms", response_model=ObjectResponse, status_code=201)
def create_room(payload: RoomCreateRequest, request: Request):
    ctx = require_permission(request, "schedule:write")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into amilyhub.rooms (name, campus, capacity, status)
                values (%s, %s, %s, %s)
                returning id, name, campus, capacity, status, created_at, updated_at
                """,
                (payload.name, payload.campus, payload.capacity, payload.status),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator, role=ctx.role, action="rooms.create",
        resource_type="room", resource_id=str(data.get("id", "")),
        payload={"request": payload.model_dump(mode="json"), "result": data},
    )
    return {"ok": True, "data": data}


@app.put("/api/v1/rooms/{room_id}", response_model=ObjectResponse)
def update_room(room_id: int, payload: RoomUpdateRequest, request: Request):
    ctx = require_permission(request, "schedule:write")
    updates = payload.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one field is required")
    set_clauses = [f"{k} = %s" for k in updates.keys()]
    set_clauses.append("updated_at = now()")
    values = list(updates.values()) + [room_id]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                update amilyhub.rooms set {', '.join(set_clauses)}
                where id = %s
                returning id, name, campus, capacity, status, created_at, updated_at
                """,
                tuple(values),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            if not row:
                raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator, role=ctx.role, action="rooms.update",
        resource_type="room", resource_id=str(room_id),
        payload={"request": updates, "result": data},
    )
    return {"ok": True, "data": data}


@app.delete("/api/v1/rooms/{room_id}", response_model=ObjectResponse)
def delete_room(room_id: int, request: Request):
    ctx = require_permission(request, "schedule:write")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from amilyhub.rooms where id=%s returning id", (room_id,))
            if cur.fetchone() is None:
                raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
            conn.commit()
    write_audit_log(
        operator=ctx.operator, role=ctx.role, action="rooms.delete",
        resource_type="room", resource_id=str(room_id),
        payload={"room_id": room_id},
    )
    return {"ok": True, "data": {"id": room_id}}


@app.get("/api/v1/classes", response_model=ListResponse)
def list_classes(
    q: str | None = Query(default=None),
    teacher_name: str | None = Query(default=None),
    status: str | None = Query(default=None),
    class_type: str | None = Query(default=None),    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    """
    List classes derived from hour_cost_flows attendance data.
    Falls back to amilyhub.classes if hour_cost_flows is empty.
    """
    ensure_classes_table()
    page, page_size, offset = pager(page, page_size)

    # Build WHERE clauses for hour_cost_flows based filtering
    hcf_clauses = [
        "h.source_class_id IS NOT NULL",
        "coalesce(nullif(h.raw_json->>'className', ''), '') <> ''",
        # Exclude test classes by name pattern
        "position('测试' in coalesce(h.raw_json->>'className', '')) = 0",
    ]
    hcf_params = []

    if q:
        hcf_clauses.append("(coalesce(nullif(h.raw_json->>'className', ''), '') ilike %s OR coalesce(nullif(h.raw_json->>'courseName', ''), '') ilike %s)")
        hcf_params.extend([f"%{q}%", f"%{q}%"])
    if teacher_name:
        hcf_clauses.append("coalesce(nullif(h.raw_json->>'teacherNames', ''), '') ilike %s")
        hcf_params.append(f"%{teacher_name}%")

    # Build WHERE clauses for final result filtering
    res_clauses = []
    res_params = []

    if status:
        res_clauses.append("status = %s")
        res_params.append(status)
    if class_type:
        if class_type == "一对一":
            res_clauses.append("is_one_on_one = true")
        else:
            res_clauses.append("is_one_on_one = false")

    hcf_cond = " and ".join(hcf_clauses)
    res_cond = f" where {' and '.join(res_clauses)} " if res_clauses else ""

    # Count total distinct classes
    total_row = fetch_one(
        f"""
        select count(DISTINCT h.source_class_id) as c
        from amilyhub.hour_cost_flows h
        where {hcf_cond}
        """,
        tuple(hcf_params),
    )
    total = int(total_row.get("c", 0) or 0)

    # If no data in hour_cost_flows, fall back to amilyhub.classes
    if total == 0:
        clauses2, params2 = [], []
        if q:
            clauses2.append("(name ilike %s or coalesce(description,'') ilike %s)")
            params2.extend([f"%{q}%", f"%{q}%"])
        if teacher_name:
            clauses2.append("teacher_id ilike %s")
            params2.append(f"%{teacher_name}%")
        if status:
            clauses2.append("status = %s")
            params2.append(status)
        if class_type:
            clauses2.append("type = %s")
            params2.append(class_type)
        cond2 = f" where {' and '.join(clauses2)} " if clauses2 else ""
        total_row2 = fetch_one(f"select count(*) as c from amilyhub.classes {cond2}", tuple(params2))
        total = int(total_row2.get("c", 0) or 0)

        rows = fetch_rows(
            f"""
            select
              source_class_id as id,
              name,
              coalesce(type, '班课') as class_type,
              coalesce(campus, '-') as campus,
              capacity,
              coalesce(description, '') as description,
              coalesce(start_date, current_date) as start_date,
              coalesce(end_date, current_date) as end_date,
              coalesce(status, '开班中') as status,
              created_at,
              updated_at,
              '-' as course_name,
              '-' as teacher_name,
              0 as student_count,
              false as is_one_on_one
            from amilyhub.classes
            {cond2}
            order by source_class_id desc
            limit %s offset %s
            """,
            tuple(params2 + [page_size, offset]),
        )
        return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}

    # Derive class list from hour_cost_flows
    rows = fetch_rows(
        f"""
        with class_base as (
          select
            h.source_class_id,
            coalesce(nullif(h.raw_json->>'className', ''), '-') as name,
            coalesce(nullif(h.raw_json->>'courseName', ''), '-') as course_name,
            coalesce(nullif(h.raw_json->>'classroomName', ''), '-') as classroom_name,
            coalesce(nullif(h.raw_json->>'classroomId', ''), '-') as classroom_id,
            -- Try raw teacherNames, fallback to teachers table join
            coalesce(
              nullif(h.raw_json->>'teacherNames', ''),
              (SELECT t.name FROM amilyhub.teachers t WHERE t.source_teacher_id = h.source_teacher_id LIMIT 1),
              '-'
            ) as teacher_name,
            -- Determine if 1-on-1 or small group by class name pattern (case-insensitive)
            (
              position('一对一' in coalesce(h.raw_json->>'className', '')) > 0
              OR position('1对1' in coalesce(h.raw_json->>'className', '')) > 0
              OR position('1V1' in coalesce(h.raw_json->>'className', '')) > 0
              OR position('1V4' in coalesce(h.raw_json->>'className', '')) > 0
              OR position('1v1' in lower(coalesce(h.raw_json->>'className', ''))) > 0
              OR position('1v4' in lower(coalesce(h.raw_json->>'className', ''))) > 0
              OR position('1v2' in lower(coalesce(h.raw_json->>'className', ''))) > 0
            ) as is_one_on_one,
            max(h.checked_at) as latest_check
          from amilyhub.hour_cost_flows h
          where {hcf_cond}
          group by h.source_class_id, h.raw_json->>'className', h.raw_json->>'courseName',
                   h.raw_json->>'teacherNames', h.raw_json->>'classroomName', h.raw_json->>'classroomId',
                   h.source_teacher_id
        ), student_counts as (
          select
            h.source_class_id,
            count(DISTINCT h.source_student_id) as student_count
          from amilyhub.hour_cost_flows h
          where {hcf_cond}
          group by h.source_class_id
        ), class_status as (
          select
            h.source_class_id,
            case
              when max(case when s.status in ('NORMAL','在读','active','ACTIVE','LEARNING') then 1 else 0 end) = 1
              then '开班中'
              else '已结班'
            end as status
          from amilyhub.hour_cost_flows h
          left join amilyhub.students s on s.source_student_id = h.source_student_id
          where {hcf_cond}
          group by h.source_class_id
        )
        select
          cb.source_class_id as id,
          cb.name,
          cb.course_name,
          cb.teacher_name,
          cb.classroom_name,
          coalesce(sc.student_count, 0) as student_count,
          coalesce(cs.status, '开班中') as status,
          case when cb.is_one_on_one then '一对一' else '班课' end as class_type,
          0 as capacity,
          cb.source_class_id as source_class_id,
          '-' as campus,
          '-' as description,
          current_date as start_date,
          current_date as end_date,
          now() as created_at,
          now() as updated_at
        from class_base cb
        left join student_counts sc on sc.source_class_id = cb.source_class_id
        left join class_status cs on cs.source_class_id = cb.source_class_id
        {res_cond}
        order by cb.source_class_id desc
        limit %s offset %s
        """,
        tuple(hcf_params + res_params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


class ClassCreateRequest(BaseModel):
    """Audit fix: Pydantic model for creating a class."""
    source_class_id: int
    name: str
    type: str = "班课"
    course_id: str | None = None
    teacher_id: str | None = None
    campus: str = ""
    capacity: int = 0
    description: str = ""
    start_date: date | None = None
    end_date: date | None = None
    status: str = "开班中"


class ClassUpdateRequest(BaseModel):
    """Audit fix: Pydantic model for updating a class."""
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    type: str | None = None
    course_id: str | None = None
    teacher_id: str | None = None
    campus: str | None = None
    capacity: int | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None


@app.post("/api/v1/classes", response_model=ObjectResponse, status_code=201)
def create_class(payload: ClassCreateRequest):
    """Audit fix: create a new class in amilyhub.classes."""
    ensure_classes_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (payload.source_class_id,))
            if cur.fetchone():
                raise ApiError(409, "CLASS_EXISTS", "class already exists")
            cur.execute(
                """
                insert into amilyhub.classes
                (source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                returning id, source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status, created_at, updated_at
                """,
                (
                    payload.source_class_id,
                    payload.name,
                    payload.type,
                    payload.course_id,
                    payload.teacher_id,
                    payload.campus,
                    payload.capacity,
                    payload.description,
                    payload.start_date,
                    payload.end_date,
                    payload.status,
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.put("/api/v1/classes/{class_id}", response_model=ObjectResponse)
def update_class(class_id: int, payload: ClassUpdateRequest):
    """Audit fix: update an existing class."""
    ensure_classes_table()
    updates = payload.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one field is required")
    updates["updated_at"] = "now()"
    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
    values.append(class_id)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                update amilyhub.classes
                set {', '.join(set_parts)}
                where source_class_id=%s
                returning id, source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status, created_at, updated_at
                """,
                tuple(values),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.delete("/api/v1/classes/{class_id}", response_model=ObjectResponse)
def delete_class(class_id: int):
    """Audit fix: delete a class."""
    ensure_classes_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from amilyhub.classes where source_class_id=%s returning source_class_id", (class_id,))
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
            conn.commit()
    return {"ok": True, "data": {"source_class_id": row[0]}}


class ClassStudentAddRequest(BaseModel):
    """Audit fix: add a student to a class."""
    student_id: str


@app.post("/api/v1/classes/{class_id}/students", response_model=ObjectResponse)
def add_student_to_class(class_id: int, payload: ClassStudentAddRequest):
    """Audit fix: add a student to a class."""
    ensure_classes_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (class_id,))
            if not cur.fetchone():
                raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
            cur.execute("select 1 from amilyhub.students where source_student_id=%s", (payload.student_id,))
            if not cur.fetchone():
                raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
            # Store student-class association in raw_json of an enrollments table or in classes table
            # For simplicity, we track via a dedicated enrollments-like approach stored in class's raw_json
            # Check if already enrolled by looking at existing entries
            cur.execute(
                """
                select raw_json from amilyhub.classes where source_class_id=%s
                """,
                (class_id,),
            )
            existing = cur.fetchone()
            enrolled_students = []
            if existing and existing[0]:
                import json as _json
                data = existing[0] if isinstance(existing[0], dict) else _json.loads(existing[0])
                enrolled_students = data.get("enrolled_students", [])
            if payload.student_id not in enrolled_students:
                enrolled_students.append(payload.student_id)
                cur.execute(
                    """
                    update amilyhub.classes
                    set raw_json=raw_json || %s::jsonb, updated_at=now()
                    where source_class_id=%s
                    returning source_class_id
                    """,
                    (json.dumps({"enrolled_students": enrolled_students}, ensure_ascii=False), class_id),
                )
            conn.commit()
    return {"ok": True, "data": {"class_id": class_id, "student_id": payload.student_id}}


@app.delete("/api/v1/classes/{class_id}/students/{student_id}", response_model=ObjectResponse)
def remove_student_from_class(class_id: int, student_id: str):
    """Audit fix: remove a student from a class."""
    ensure_classes_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (class_id,))
            if not cur.fetchone():
                raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
            cur.execute(
                """
                select raw_json from amilyhub.classes where source_class_id=%s
                """,
                (class_id,),
            )
            existing = cur.fetchone()
            if existing and existing[0]:
                import json as _json
                data = existing[0] if isinstance(existing[0], dict) else _json.loads(existing[0])
                enrolled_students = [s for s in data.get("enrolled_students", []) if s != student_id]
                cur.execute(
                    """
                    update amilyhub.classes
                    set raw_json=raw_json || %s::jsonb, updated_at=now()
                    where source_class_id=%s
                    """,
                    (json.dumps({"enrolled_students": enrolled_students}, ensure_ascii=False), class_id),
                )
            conn.commit()
    return {"ok": True, "data": {"class_id": class_id, "student_id": student_id}}


@app.get("/api/v1/classes/{class_id}/profile", response_model=ObjectResponse)
def get_class_profile(class_id: str):
    class_info = fetch_one(
        """
        with base as (
          select
            coalesce(raw_json->>'classId','') as class_id,
            coalesce(raw_json->>'className','-') as class_name,
            coalesce(raw_json->>'courseName','-') as course_name,
            coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name,
            coalesce((raw_json->>'classEndDate')::bigint, 0) as class_end_ms,
            coalesce((raw_json->>'totalNumber')::int, 0) as total_number,
            checked_at as rollcall_time
          from amilyhub.hour_cost_flows
          where coalesce(raw_json->>'classId','')=%s
        )
        select
          class_id as id,
          max(class_name) as name,
          max(course_name) as course_name,
          max(teacher_name) as teacher_name,
          case when position('一对一' in max(class_name)) > 0 or position('1v1' in lower(max(class_name))) > 0 or position('1对1' in max(class_name)) > 0 then '一对一' else '班课' end as class_type,
          max(total_number) as student_count,
          max(total_number) as capacity,
          case when max(class_end_ms) > (extract(epoch from now()) * 1000)::bigint then '开班中' else '已结班' end as status,
          max(rollcall_time) as latest_rollcall_time
        from base
        group by class_id
        """,
        (class_id,),
    )
    if not class_info:
        raise ApiError(404, "CLASS_NOT_FOUND", "class not found")

    schedules = fetch_rows(
        """
        select
          source_id as id,
          coalesce(raw_json->>'timeRange', '-') as class_time_range,
          checked_at as rollcall_time,
          coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name,
          coalesce(raw_json->>'rollCallStateDesc', '-') as status
        from amilyhub.hour_cost_flows
        where coalesce(raw_json->>'classId','')=%s
        order by checked_at desc nulls last, id desc
        limit 50
        """,
        (class_id,),
    )

    students = fetch_rows(
        """
        with s as (
          select
            coalesce(raw_json->>'studentId','') as student_id,
            max(coalesce(raw_json->>'studentName', '-')) as student_name,
            max(coalesce(raw_json->>'rollCallStateDesc', '-')) as latest_status,
            max(checked_at) as latest_time,
            count(*) as class_count
          from amilyhub.hour_cost_flows
          where coalesce(raw_json->>'classId','')=%s
            and coalesce(raw_json->>'studentId','') <> ''
          group by coalesce(raw_json->>'studentId','')
        )
        select
          student_id,
          student_name,
          latest_status,
          latest_time,
          class_count
        from s
        order by latest_time desc nulls last
        """,
        (class_id,),
    )

    attendance = fetch_rows(
        """
        select
          source_id as id,
          coalesce(raw_json->>'studentName', '-') as student_name,
          coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name,
          checked_at as rollcall_time,
          coalesce(raw_json->>'rollCallStateDesc', '-') as status,
          coalesce(raw_json->>'timeRange', '-') as class_time_range
        from amilyhub.hour_cost_flows
        where coalesce(raw_json->>'classId','')=%s
        order by checked_at desc nulls last, id desc
        limit 100
        """,
        (class_id,),
    )

    return {"ok": True, "data": {"class": class_info, "schedules": schedules, "students": students, "attendance": attendance}}


@app.get("/api/v1/schedules-hcf", response_model=ListResponse)
def list_schedules_hcf(
    view: str = Query(default="time"),
    q: str | None = Query(default=None),
    date: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    page, page_size, offset = pager(page, page_size)

    view_expr_map = {
        "time": "coalesce(h.raw_json->>'timeRange', '-')",
        "teacher": "coalesce(h.raw_json->>'teacherNames', h.raw_json->>'teacherName', '-')",
        "room": "coalesce(h.raw_json->>'classRoomName', h.raw_json->>'roomName', '-')",
        "class": "coalesce(h.raw_json->>'className', '-')",
    }
    view_expr = view_expr_map.get(view, view_expr_map["time"])

    clauses, params = ["coalesce(h.raw_json->>'classId','') <> ''"], []
    if q:
        clauses.append("(coalesce(h.raw_json->>'className','') ilike %s or coalesce(h.raw_json->>'teacherNames', h.raw_json->>'teacherName','') ilike %s or coalesce(h.raw_json->>'studentName','') ilike %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if date:
        clauses.append("to_char(h.checked_at at time zone 'Pacific/Auckland', 'YYYY-MM-DD') = %s")
        params.append(date)

    cond = " where " + " and ".join(clauses)

    total = fetch_one(
        f"""
        select count(*) as c
        from amilyhub.hour_cost_flows h
        {cond}
        """,
        tuple(params),
    )

    rows = fetch_rows(
        f"""
        select
          h.source_id as id,
          {view_expr} as view_key,
          h.checked_at as date_time,
          coalesce(h.raw_json->>'timeRange', '-') as time_range,
          coalesce(h.raw_json->>'className', '-') as class_name,
          coalesce(h.raw_json->>'teacherNames', h.raw_json->>'teacherName', '-') as teacher_name,
          coalesce(h.raw_json->>'classRoomName', h.raw_json->>'roomName', '-') as room_name,
          coalesce(h.raw_json->>'studentName', '-') as student_name,
          coalesce(h.raw_json->>'rollCallStateDesc', '-') as status
        from amilyhub.hour_cost_flows h
        {cond}
        order by h.checked_at desc nulls last, h.id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )

    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": int((total or {}).get("c", 0) or 0)}}


@app.get("/api/v1/rollcalls", response_model=ListResponse)
def list_rollcalls(
    q: str | None = Query(default=None),
    student_name: str | None = Query(default=None),
    teacher_name: str | None = Query(default=None),
    status: str | None = Query(default=None),
    class_name: str | None = Query(default=None),
    date: str | None = Query(default=None),
    rollcall_date_start: str | None = Query(default=None),
    rollcall_date_end: str | None = Query(default=None),
    class_date_start: str | None = Query(default=None),
    class_date_end: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []

    if q:
        clauses.append("(class_name ilike %s or course_name ilike %s or teacher_name ilike %s or coalesce(raw_json->>'student_names','') ilike %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
    if student_name:
        clauses.append("coalesce(raw_json->>'student_names','') ilike %s")
        params.append(f"%{student_name}%")
    if teacher_name:
        clauses.append("teacher_name ilike %s")
        params.append(f"%{teacher_name}%")
    if class_name:
        clauses.append("class_name ilike %s")
        params.append(f"%{class_name}%")
    if status:
        clauses.append("status = %s")
        params.append(status)

    if date:
        clauses.append("left(rollcall_time, 10) = %s")
        params.append(date)
    if rollcall_date_start:
        clauses.append("left(rollcall_time, 10) >= %s")
        params.append(rollcall_date_start)
    if rollcall_date_end:
        clauses.append("left(rollcall_time, 10) <= %s")
        params.append(rollcall_date_end)
    if class_date_start:
        clauses.append("left(class_time_range, 10) >= %s")
        params.append(class_date_start)
    if class_date_end:
        clauses.append("left(class_time_range, 10) <= %s")
        params.append(class_date_end)

    cond = f" where {' and '.join(clauses)}" if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.rollcalls {cond}", tuple(params))
    rows = fetch_rows(
        f"""
        select
          source_row_hash,
          student_name,
          class_name,
          course_name,
          teacher_name,
          rollcall_time,
          class_time_range,
          status,
          cost_amount_cents,
          coalesce((raw_json->>'teaching_hours')::numeric, 0) as teaching_hours,
          coalesce(raw_json->>'attendance_summary', '-') as attendance_summary,
          coalesce((raw_json->>'actual_students')::int, 0) as actual_students,
          coalesce((raw_json->>'total_students')::int, 0) as total_students,
          coalesce(raw_json->>'student_names', '-') as student_names
        from amilyhub.rollcalls
        {cond}
        order by rollcall_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": int((total or {}).get('c', 0) or 0)}}


@app.get("/api/v1/rollcalls/{source_id}", response_model=ObjectResponse)
def get_rollcall_detail(source_id: str):
    row = fetch_one(
        """
        select
          source_row_hash,
          class_name,
          course_name,
          teacher_name,
          rollcall_time,
          class_time_range,
          status,
          cost_amount_cents,
          coalesce((raw_json->>'teaching_hours')::numeric, 0) as teaching_hours,
          coalesce(raw_json->>'attendance_summary', '-') as attendance_summary,
          coalesce((raw_json->>'actual_students')::int, 0) as actual_students,
          coalesce((raw_json->>'total_students')::int, 0) as total_students,
          coalesce(raw_json->>'student_names', '-') as student_names,
          coalesce(raw_json->'students', '[]'::jsonb) as students,
          raw_json
        from amilyhub.rollcalls
        where source_row_hash=%s
        """,
        (source_id,),
    )
    if not row:
        raise ApiError(404, "ROLLCALL_NOT_FOUND", "rollcall not found")
    return {"ok": True, "data": row}


@app.post("/api/v1/rollcalls/{source_id}/confirm", response_model=ObjectResponse)
def confirm_rollcall(source_id: str, payload: RollcallConfirmRequest):
    row = fetch_one(
        """
        select source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, raw_json
        from amilyhub.rollcalls
        where source_row_hash=%s
        """,
        (source_id,),
    )
    if not row:
        raise ApiError(404, "ROLLCALL_NOT_FOUND", "rollcall not found")

    status = (payload.status or row.get("status") or "正常").strip()
    operator = payload.operator or "system"
    reason = payload.reason or ""
    normal_statuses = {"正常", "已到", "出勤", "正常到课"}
    leave_statuses = {"请假"}
    absent_statuses = {"旷课"}
    revoke_statuses = {"撤销确认", "撤销", "取消确认"}

    if status in revoke_statuses:
        flow_source_id = f"ROLLCALL_{source_id}"
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("delete from amilyhub.hour_cost_flows where source_id=%s", (flow_source_id,))
                revoked = cur.rowcount > 0
                cur.execute("update amilyhub.rollcalls set status=%s where source_row_hash=%s", (status, source_id))
                conn.commit()
        return {
            "ok": True,
            "data": {
                "rollcall": source_id,
                "status": status,
                "revoked": revoked,
                "rollback": "deleted_hour_cost_flow",
                "idempotent_key": flow_source_id,
            },
        }

    if status in normal_statuses:
        cost_hours = 1
        cost_type = "课消"
    elif status in leave_statuses:
        cost_hours = 0
        cost_type = "请假"
    elif status in absent_statuses:
        cost_hours = 1
        cost_type = "旷课课消"
    else:
        return {"ok": True, "data": {"rollcall": source_id, "status": status, "skipped": True}}

    raw = row.get("raw_json") or {}
    student_id = raw.get("studentId") if isinstance(raw, dict) else None
    if not student_id:
        hit = fetch_one("select source_student_id from amilyhub.students where name=%s order by id desc limit 1", (row.get("student_name"),))
        student_id = (hit or {}).get("source_student_id")

    # Extract class/course IDs from rollcall raw_json
    source_class_id = None
    source_course_id = None
    if isinstance(raw, dict):
        source_class_id = raw.get("classId") or raw.get("class_id")
        source_course_id = raw.get("courseId") or raw.get("course_id")

    # Calculate cost_amount_cents based on course pricing
    # For "正常" and "旷课" → charge; for "请假" → cost stays 0
    cost_amount_cents = 0
    if cost_hours > 0:
        cost_amount_cents = calculate_cost_amount_cents(
            source_class_id=source_class_id,
            source_course_id=source_course_id,
            class_time_range=row.get("class_time_range"),
        )

    flow_source_id = f"ROLLCALL_{source_id}"
    flow_raw = {
        "from": "rollcall_confirm",
        "rollcallId": source_id,
        "className": row.get("class_name"),
        "courseName": row.get("course_name"),
        "teacherNames": row.get("teacher_name"),
        "studentName": row.get("student_name"),
        "studentId": student_id,
        "classId": source_class_id,
        "courseId": source_course_id,
        "checkedPurchaseLessons": cost_hours,
        "checkedGiftLessons": 0,
        "costAmountCents": cost_amount_cents,
        "status": status,
        "operator": operator,
        "reason": reason,
        "reversible": True,
    }

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into amilyhub.hour_cost_flows
                (source_id, source_student_id, source_teacher_id, source_class_id, source_course_id, cost_type, source_type, cost_hours, cost_amount_cents, checked_at, raw_json)
                values (%s, %s, null, %s, %s, %s, %s, %s, %s, now(), %s::jsonb)
                on conflict (source_id) do update
                  set source_student_id = excluded.source_student_id,
                      source_class_id = excluded.source_class_id,
                      source_course_id = excluded.source_course_id,
                      cost_type = excluded.cost_type,
                      source_type = excluded.source_type,
                      cost_hours = excluded.cost_hours,
                      cost_amount_cents = excluded.cost_amount_cents,
                      raw_json = excluded.raw_json,
                      checked_at = now()
                returning source_id, source_student_id, cost_hours, cost_amount_cents, checked_at
                """,
                (
                    flow_source_id,
                    student_id,
                    source_class_id,
                    source_course_id,
                    cost_type,
                    "ROLLCALL",
                    cost_hours,
                    cost_amount_cents,
                    json.dumps(flow_raw, ensure_ascii=False, default=str),
                ),
            )
            flow = cur.fetchone()
            flow_cols = [d.name for d in cur.description]
            cur.execute("update amilyhub.rollcalls set status=%s where source_row_hash=%s", (status, source_id))
            conn.commit()

    return {
        "ok": True,
        "data": {
            "rollcall": source_id,
            "status": status,
            "hour_cost_flow": dict(zip(flow_cols, flow)),
            "cost_amount_cents": cost_amount_cents,
            "idempotent_key": flow_source_id,
        },
    }


@app.get("/api/v1/schedule-events", response_model=ListResponse)
def list_schedule_events(
    q: str | None = Query(default=None),
    date: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=200),
):
    ensure_schedule_events_table()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if q:
        clauses.append("(class_name ilike %s or teacher_name ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if date:
        clauses.append("to_char(start_time at time zone 'Pacific/Auckland', 'YYYY-MM-DD') = %s")
        params.append(date)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.schedule_events {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select
          id,
          class_name,
          teacher_name,
          room_name,
          room_id,
          status,
          start_time,
          end_time,
          source_course_id,
          source_class_id,
          note
        from amilyhub.schedule_events
        {cond}
        order by start_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


@app.post("/api/v1/schedule-events", response_model=ObjectResponse, status_code=201)
def create_schedule_event(payload: ScheduleEventCreateRequest, request: Request):
    ctx = require_permission(request, "schedule:write")
    ensure_schedule_events_table()
    ensure_rooms_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select 1
                from amilyhub.schedule_events
                where teacher_name = %s
                  and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
                limit 1
                """,
                (payload.teacher_name, payload.start_time, payload.end_time),
            )
            if cur.fetchone():
                raise ApiError(409, "SCHEDULE_CONFLICT", "teacher already has a schedule at this time")

            # Room conflict check
            if payload.room_id:
                cur.execute(
                    """
                    select 1
                    from amilyhub.schedule_events
                    where room_id = %s
                      and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
                    limit 1
                    """,
                    (payload.room_id, payload.start_time, payload.end_time),
                )
                if cur.fetchone():
                    raise ApiError(409, "ROOM_CONFLICT", "room is already booked at this time")

                # Capacity validation: check room capacity vs class capacity
                cur.execute(
                    "select capacity from amilyhub.rooms where id=%s",
                    (payload.room_id,),
                )
                room_row = cur.fetchone()
                if not room_row:
                    raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
                room_capacity = room_row["capacity"] or 0
                if payload.source_class_id:
                    cur.execute(
                        "select capacity from amilyhub.classes where source_class_id=%s",
                        (payload.source_class_id,),
                    )
                    class_row = cur.fetchone()
                    if class_row and class_row["capacity"] and room_capacity > 0:
                        if class_row["capacity"] > room_capacity:
                            raise ApiError(409, "ROOM_CAPACITY_EXCEEDED",
                                f"class capacity ({class_row['capacity']}) exceeds room capacity ({room_capacity})")

            raw = payload.model_dump(mode="json")
            cur.execute(
                """
                insert into amilyhub.schedule_events
                (class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note, raw_json)
                values (%s,%s,%s::timestamptz,%s::timestamptz,%s,%s,%s,%s,%s,%s,%s::jsonb)
                returning id, class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note
                """,
                (
                    payload.class_name,
                    payload.teacher_name,
                    payload.start_time,
                    payload.end_time,
                    payload.room_name,
                    payload.room_id,
                    payload.status,
                    payload.source_course_id,
                    payload.source_class_id,
                    payload.note,
                    json.dumps(raw, ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator,
        role=ctx.role,
        action="schedule.create",
        resource_type="schedule_event",
        resource_id=str(data.get("id") or ""),
        payload={"request": payload.model_dump(mode="json"), "result": data},
    )
    return {"ok": True, "data": data}


@app.put("/api/v1/schedule-events/{event_id}", response_model=ObjectResponse)
def update_schedule_event(event_id: int, payload: ScheduleEventCreateRequest, request: Request):
    ctx = require_permission(request, "schedule:write")
    ensure_schedule_events_table()
    ensure_rooms_table()
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Check teacher conflict with other events
            cur.execute(
                """
                select 1
                from amilyhub.schedule_events
                where id != %s
                  and teacher_name = %s
                  and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
                limit 1
                """,
                (event_id, payload.teacher_name, payload.start_time, payload.end_time),
            )
            if cur.fetchone():
                raise ApiError(409, "SCHEDULE_CONFLICT", "teacher already has a schedule at this time")

            # Room conflict check
            if payload.room_id:
                cur.execute(
                    """
                    select 1
                    from amilyhub.schedule_events
                    where id != %s
                      and room_id = %s
                      and tstzrange(start_time, end_time, '[)') && tstzrange(%s::timestamptz, %s::timestamptz, '[)')
                    limit 1
                    """,
                    (event_id, payload.room_id, payload.start_time, payload.end_time),
                )
                if cur.fetchone():
                    raise ApiError(409, "ROOM_CONFLICT", "room is already booked at this time")

                # Capacity validation
                cur.execute("select capacity from amilyhub.rooms where id=%s", (payload.room_id,))
                room_row = cur.fetchone()
                if not room_row:
                    raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
                room_capacity = room_row["capacity"] or 0
                if payload.source_class_id:
                    cur.execute(
                        "select capacity from amilyhub.classes where source_class_id=%s",
                        (payload.source_class_id,),
                    )
                    class_row = cur.fetchone()
                    if class_row and class_row["capacity"] and room_capacity > 0:
                        if class_row["capacity"] > room_capacity:
                            raise ApiError(409, "ROOM_CAPACITY_EXCEEDED",
                                f"class capacity ({class_row['capacity']}) exceeds room capacity ({room_capacity})")

            raw = payload.model_dump(mode="json")
            cur.execute(
                """
                update amilyhub.schedule_events
                set class_name=%s, teacher_name=%s, start_time=%s::timestamptz, end_time=%s::timestamptz,
                    room_name=%s, room_id=%s, status=%s, source_course_id=%s, source_class_id=%s,
                    note=%s, raw_json=%s::jsonb, updated_at=now()
                where id=%s
                returning id, class_name, teacher_name, start_time, end_time, room_name, room_id, status, source_course_id, source_class_id, note
                """,
                (
                    payload.class_name, payload.teacher_name, payload.start_time, payload.end_time,
                    payload.room_name, payload.room_id, payload.status,
                    payload.source_course_id, payload.source_class_id, payload.note,
                    json.dumps(raw, ensure_ascii=False, default=str), event_id,
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            if not row:
                raise ApiError(404, "SCHEDULE_EVENT_NOT_FOUND", "schedule event not found")
            conn.commit()
    data = dict(zip(cols, row))
    write_audit_log(
        operator=ctx.operator, role=ctx.role, action="schedule.update",
        resource_type="schedule_event", resource_id=str(event_id),
        payload={"request": payload.model_dump(mode="json"), "result": data},
    )
    return {"ok": True, "data": data}


@app.delete("/api/v1/schedule-events/{event_id}", response_model=ObjectResponse)
def delete_schedule_event(event_id: int, request: Request):
    ctx = require_permission(request, "schedule:write")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "delete from amilyhub.schedule_events where id=%s returning id",
                (event_id,),
            )
            if cur.fetchone() is None:
                raise ApiError(404, "SCHEDULE_EVENT_NOT_FOUND", "schedule event not found")
            conn.commit()
    write_audit_log(
        operator=ctx.operator, role=ctx.role, action="schedule.delete",
        resource_type="schedule_event", resource_id=str(event_id),
        payload={"event_id": event_id},
    )
    return {"ok": True, "data": {"id": event_id}}


@app.get("/api/v1/schedules", response_model=ListResponse)
def list_schedules(
    view: str | None = Query(default="time"),
    q: str | None = Query(default=None),
    date: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=200),
):
    ensure_schedule_events_table()
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if q:
        clauses.append("(class_name ilike %s or teacher_name ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if date:
        clauses.append("to_char(start_time at time zone 'Pacific/Auckland', 'YYYY-MM-DD') = %s")
        params.append(date)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.schedule_events {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select
          id::text as id,
          'time'::text as view_key,
          start_time as date_time,
          to_char(start_time at time zone 'Pacific/Auckland', 'YYYY-MM-DD HH24:MI')
            || ' - ' ||
          to_char(end_time at time zone 'Pacific/Auckland', 'HH24:MI') as time_range,
          class_name,
          teacher_name,
          coalesce(room_name, '-') as room_name,
          '-'::text as student_name,
          status
        from amilyhub.schedule_events
        {cond}
        order by start_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}


@app.get("/api/v1/data/integrity", response_model=IntegrityCheckResponse)
def check_data_integrity(limit: int = Query(default=20, ge=1, le=200)):
    issues: list[IntegrityIssue] = []

    checks = [
        (
            "null",
            "orders",
            "source_order_id",
            "select count(*) as c from amilyhub.orders where source_order_id is null",
            "订单主键不应为空",
        ),
        (
            "null",
            "students",
            "source_student_id",
            "select count(*) as c from amilyhub.students where source_student_id is null",
            "学生主键不应为空",
        ),
        (
            "orphan",
            "orders",
            "source_student_id",
            """
            select count(*) as c
            from amilyhub.orders o
            where o.source_student_id is not null
              and not exists (
                select 1 from amilyhub.students s
                where s.source_student_id = o.source_student_id
              )
            """,
            "订单关联了不存在的学生",
        ),
        (
            "orphan",
            "hour_cost_flows",
            "source_student_id",
            """
            select count(*) as c
            from amilyhub.hour_cost_flows h
            where h.source_student_id is not null
              and not exists (
                select 1 from amilyhub.students s
                where s.source_student_id = h.source_student_id
              )
            """,
            "课耗流水关联了不存在的学生",
        ),
        (
            "duplicate",
            "rollcalls",
            "source_row_hash",
            """
            select coalesce(sum(cnt), 0) as c
            from (
              select greatest(count(*) - 1, 0) as cnt
              from amilyhub.rollcalls
              group by source_row_hash
              having count(*) > 1
            ) x
            """,
            "点名哈希存在重复",
        ),
    ]

    for kind, table, field, sql, note in checks:
        c = int((fetch_one(sql) or {}).get("c", 0) or 0)
        if c > 0:
            issues.append(
                IntegrityIssue(
                    kind=kind,
                    table=table,
                    field=field,
                    count=c,
                    note=note,
                )
            )

    return {
        "ok": True,
        "data": {
            "has_issues": len(issues) > 0,
            "issue_count": len(issues),
            "issues": [i.model_dump() for i in issues[:limit]],
        },
    }
