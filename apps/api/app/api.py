from fastapi import FastAPI, Query, HTTPException
from .db import fetch_rows, fetch_one

app = FastAPI(title="AmilyHub API", version="v1")


def pager(page: int, page_size: int):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    return page, page_size, (page - 1) * page_size


@app.get("/api/v1/health")
def health():
    row = fetch_one("select now() as server_time")
    return {"ok": True, "server_time": row["server_time"] if row else None}


@app.get("/api/v1/students")
def list_students(
    q: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    cond = ""
    params: list = []
    if q:
        cond = " where name ilike %s or phone ilike %s "
        params.extend([f"%{q}%", f"%{q}%"])

    total = fetch_one(f"select count(*) as c from amilyhub.students {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select id, source_student_id, name, phone, gender, birthday, status, source_created_at
        from amilyhub.students
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"page": page, "page_size": page_size, "total": total, "items": rows}


@app.get("/api/v1/orders")
def list_orders(
    student_id: str | None = Query(default=None),
    state: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    page, page_size, offset = pager(page, page_size)
    clauses = []
    params: list = []
    if student_id:
        clauses.append("source_student_id = %s")
        params.append(student_id)
    if state:
        clauses.append("order_state = %s")
        params.append(state)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.orders {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select id, source_order_id, source_student_id, order_type, order_state,
               receivable_cents, received_cents, arrears_cents, source_created_at
        from amilyhub.orders
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"page": page, "page_size": page_size, "total": total, "items": rows}


@app.get("/api/v1/hour-cost-flows")
def list_hour_cost_flows(
    student_id: str | None = Query(default=None),
    teacher_id: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    page, page_size, offset = pager(page, page_size)
    clauses = []
    params: list = []
    if student_id:
        clauses.append("source_student_id = %s")
        params.append(student_id)
    if teacher_id:
        clauses.append("source_teacher_id = %s")
        params.append(teacher_id)
    cond = f" where {' and '.join(clauses)} " if clauses else ""

    total = fetch_one(f"select count(*) as c from amilyhub.hour_cost_flows {cond}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select id, source_id, source_student_id, source_teacher_id, source_class_id, source_course_id,
               cost_type, source_type, cost_hours, cost_amount_cents, checked_at, source_created_at
        from amilyhub.hour_cost_flows
        {cond}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"page": page, "page_size": page_size, "total": total, "items": rows}


@app.get("/api/v1/orders/{source_order_id}")
def get_order(source_order_id: str):
    row = fetch_one(
        "select * from amilyhub.orders where source_order_id = %s limit 1",
        (source_order_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="order not found")
    return row
