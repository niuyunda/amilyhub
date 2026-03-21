import json
from datetime import date
import time
import random
from decimal import Decimal
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


class StudentUpsertRequest(BaseModel):
    source_student_id: str | None = None
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birthday: date | None = None
    status: str | None = None


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


class OrderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_student_id: str | None = None
    order_type: str | None = None
    order_state: str | None = None
    receivable_cents: int | None = None
    received_cents: int | None = None
    arrears_cents: int | None = None


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


@app.get("/api/v1/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary():
    students = as_int(fetch_one("select count(*) as c from amilyhub.students")["c"])
    active_students = as_int(fetch_one("select count(*) as c from amilyhub.students where status in ('active','ACTIVE','在读','NORMAL','LEARNING')")["c"])
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
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
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
          greatest(coalesce(p.purchased_lessons, 0) - coalesce(c.consumed_lessons, 0), 0)::numeric as remain_hours
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
    row = fetch_one(
        "select id, source_student_id, name, phone, gender, birthday, status, source_created_at from amilyhub.students where source_student_id=%s",
        (source_student_id,),
    )
    if not row:
        raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
    return {"ok": True, "data": row}


@app.get("/api/v1/students/{source_student_id}/profile", response_model=ObjectResponse)
def get_student_profile(source_student_id: str):
    student = fetch_one(
        """
        select id, source_student_id, name, phone, gender, birthday, status, source_created_at
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

            cur.execute(
                """
                insert into amilyhub.students
                (source_student_id, name, phone, gender, birthday, status, raw_json)
                values (%s, %s, %s, %s, %s, %s, %s::jsonb)
                returning id, source_student_id, name, phone, gender, birthday, status, source_created_at
                """,
                (
                    source_student_id,
                    payload.name,
                    payload.phone,
                    payload.gender,
                    payload.birthday,
                    payload.status or "在读",
                    json.dumps({**payload.model_dump(mode="json"), "source_student_id": source_student_id, "status": payload.status or "在读"}, ensure_ascii=False, default=str),
                ),
            )
            row = cur.fetchone()
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.put("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def update_student(source_student_id: str, payload: StudentUpdateRequest):
    updates = payload.model_dump(mode="json", exclude_none=True)
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")

    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
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
                returning id, source_student_id, name, phone, gender, birthday, status, source_created_at
                """,
                tuple(values),
            )
            row = cur.fetchone()
            if not row:
                raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
            cols = [d.name for d in cur.description]
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


@app.get("/api/v1/teachers", response_model=ListResponse)
def list_teachers(q: str | None = Query(default=None), page: int = Query(default=1), page_size: int = Query(default=20)):
    clauses, params = [], []
    if q:
        clauses.append("(name ilike %s or phone ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    return list_query(
        "teachers",
        "id, source_teacher_id, name, phone, gender, last_month_lessons, current_month_lessons, total_finished_lessons",
        clauses,
        params,
        page,
        page_size,
    )


@app.get("/api/v1/orders", response_model=ListResponse)
def list_orders(
    student_id: str | None = Query(default=None),
    state: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    clauses, params = [], []
    if student_id:
        clauses.append("source_student_id = %s")
        params.append(student_id)
    if state:
        clauses.append("order_state = %s")
        params.append(state)
    return list_query(
        "orders",
        "id, source_order_id, source_student_id, order_type, order_state, receivable_cents, received_cents, arrears_cents, source_created_at, source_paid_at",
        clauses,
        params,
        page,
        page_size,
    )


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
            conn.commit()
    return {"ok": True, "data": dict(zip(cols, row))}


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


@app.get("/api/v1/income-expense", response_model=ListResponse)
def list_income_expense(
    direction: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    operation_date_from: date | None = Query(default=None),
    operation_date_to: date | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    clauses, params = [], []
    if direction:
        clauses.append("direction = %s")
        params.append(direction)
    if item_type:
        clauses.append("item_type = %s")
        params.append(item_type)
    if operation_date_from:
        clauses.append("operation_date >= %s")
        params.append(operation_date_from)
    if operation_date_to:
        clauses.append("operation_date <= %s")
        params.append(operation_date_to)
    return list_query(
        "income_expense",
        "id, source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at",
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


@app.get("/api/v1/classes", response_model=ListResponse)
def list_classes(
    q: str | None = Query(default=None),
    teacher_name: str | None = Query(default=None),
    status: str | None = Query(default=None),
    class_type: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    clauses, params = [], []
    if q:
        clauses.append("(class_name ilike %s or course_name ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if teacher_name:
        clauses.append("teacher_name ilike %s")
        params.append(f"%{teacher_name}%")
    if status:
        clauses.append("status = %s")
        params.append(status)
    if class_type:
        clauses.append("class_type = %s")
        params.append(class_type)

    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total_row = fetch_one(
        f"""
        with base as (
          select
            coalesce(raw_json->>'classId','') as class_id,
            coalesce(raw_json->>'className','') as class_name,
            coalesce(raw_json->>'courseName','') as course_name,
            coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '') as teacher_name,
            coalesce((raw_json->>'classEndDate')::bigint, 0) as class_end_ms,
            coalesce((raw_json->>'totalNumber')::int, 0) as total_number
          from amilyhub.hour_cost_flows
          where coalesce(raw_json->>'classId','') <> ''
        ), agg as (
          select
            class_id,
            max(class_name) as class_name,
            max(course_name) as course_name,
            max(teacher_name) as teacher_name,
            max(total_number) as student_count,
            case when position('一对一' in max(class_name)) > 0 or position('1v1' in lower(max(class_name))) > 0 or position('1对1' in max(class_name)) > 0 then '一对一' else '班课' end as class_type,
            case when max(class_end_ms) > (extract(epoch from now()) * 1000)::bigint then '开班中' else '已结班' end as status
          from base
          group by class_id
        )
        select count(*) as c from agg {cond}
        """,
        tuple(params),
    )

    rows = fetch_rows(
        f"""
        with base as (
          select
            coalesce(raw_json->>'classId','') as class_id,
            coalesce(raw_json->>'className','') as class_name,
            coalesce(raw_json->>'courseName','') as course_name,
            coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '') as teacher_name,
            coalesce((raw_json->>'classEndDate')::bigint, 0) as class_end_ms,
            coalesce((raw_json->>'totalNumber')::int, 0) as total_number
          from amilyhub.hour_cost_flows
          where coalesce(raw_json->>'classId','') <> ''
        ), agg as (
          select
            class_id,
            max(class_name) as class_name,
            max(course_name) as course_name,
            max(teacher_name) as teacher_name,
            max(total_number) as student_count,
            case when position('一对一' in max(class_name)) > 0 or position('1v1' in lower(max(class_name))) > 0 or position('1对1' in max(class_name)) > 0 then '一对一' else '班课' end as class_type,
            case when max(class_end_ms) > (extract(epoch from now()) * 1000)::bigint then '开班中' else '已结班' end as status
          from base
          group by class_id
        )
        select
          class_id as id,
          class_name as name,
          course_name,
          teacher_name,
          class_type,
          '-'::text as campus,
          student_count,
          greatest(student_count, 1) as capacity,
          status
        from agg
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": int((total_row or {}).get('c', 0) or 0)}}


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


@app.get("/api/v1/schedules", response_model=ListResponse)
def list_schedules(
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
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    page, page_size, offset = pager(page, page_size)
    clauses, params = ["coalesce(h.raw_json->>'classId','') <> ''"], []
    if q:
        clauses.append("(coalesce(h.raw_json->>'studentName','') ilike %s or coalesce(h.raw_json->>'teacherNames',h.raw_json->>'teacherName','') ilike %s or coalesce(h.raw_json->>'className','') ilike %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if student_name:
        clauses.append("coalesce(h.raw_json->>'studentName','') ilike %s")
        params.append(f"%{student_name}%")
    if teacher_name:
        clauses.append("coalesce(h.raw_json->>'teacherNames',h.raw_json->>'teacherName','') ilike %s")
        params.append(f"%{teacher_name}%")
    if class_name:
        clauses.append("coalesce(h.raw_json->>'className','') ilike %s")
        params.append(f"%{class_name}%")
    if status:
        if status == "已点名":
            clauses.append("coalesce(h.raw_json->>'state','') = 'VALID'")
        elif status == "已作废":
            clauses.append("coalesce(h.raw_json->>'state','') = 'INVALID'")
        else:
            clauses.append("coalesce(h.raw_json->>'state','') = %s")
            params.append(status)
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
          h.id,
          h.source_id as source_row_hash,
          coalesce(h.raw_json->>'studentName','-') as student_name,
          coalesce(h.raw_json->>'className','-') as class_name,
          coalesce(h.raw_json->>'courseName','-') as course_name,
          coalesce(h.raw_json->>'teacherNames',h.raw_json->>'teacherName','-') as teacher_name,
          coalesce(to_timestamp(nullif(h.raw_json->>'checkedDate','')::bigint / 1000.0), h.checked_at) as rollcall_time,
          to_char(coalesce(to_timestamp(nullif(h.raw_json->>'checkedDate','')::bigint / 1000.0), h.checked_at) at time zone 'Pacific/Auckland', 'HH24:MI') as class_time_range,
          case
            when coalesce(h.raw_json->>'state','') = 'VALID' then '已点名'
            when coalesce(h.raw_json->>'state','') = 'INVALID' then '已作废'
            else '-'
          end as status,
          (coalesce((h.raw_json->>'checkedPurchaseLessons')::numeric,0) + coalesce((h.raw_json->>'checkedGiftLessons')::numeric,0)) * 100 as cost_amount_cents,
          h.raw_json->>'rollCallTeacherId' as roll_call_teacher_id,
          h.raw_json->>'classId' as class_id,
          h.raw_json->>'courseId' as course_id
        from amilyhub.hour_cost_flows h
        {cond}
        order by h.checked_at desc nulls last, h.id desc
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
          h.id,
          h.source_id,
          coalesce(h.raw_json->>'studentName','-') as student_name,
          coalesce(h.raw_json->>'className','-') as class_name,
          coalesce(h.raw_json->>'courseName','-') as course_name,
          coalesce(h.raw_json->>'teacherNames',h.raw_json->>'teacherName','-') as teacher_name,
          coalesce(to_timestamp(nullif(h.raw_json->>'checkedDate','')::bigint / 1000.0), h.checked_at) as rollcall_time,
          coalesce(h.raw_json->>'checkedDate','-') as checked_date,
          to_char(coalesce(to_timestamp(nullif(h.raw_json->>'checkedDate','')::bigint / 1000.0), h.checked_at) at time zone 'Pacific/Auckland', 'HH24:MI') as class_time_range,
          case
            when coalesce(h.raw_json->>'state','') = 'VALID' then '已点名'
            when coalesce(h.raw_json->>'state','') = 'INVALID' then '已作废'
            else '-'
          end as status,
          coalesce((h.raw_json->>'checkedPurchaseLessons')::numeric,0) as checked_purchase_lessons,
          coalesce((h.raw_json->>'checkedGiftLessons')::numeric,0) as checked_gift_lessons,
          h.raw_json
        from amilyhub.hour_cost_flows h
        where h.source_id=%s
        """,
        (source_id,),
    )
    if not row:
        raise ApiError(404, "ROLLCALL_NOT_FOUND", "rollcall not found")
    return {"ok": True, "data": row}


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
