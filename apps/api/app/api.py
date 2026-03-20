from fastapi import FastAPI, Query, HTTPException
from .db import fetch_rows, fetch_one

app = FastAPI(title="AmilyHub API", version="v1")


def pager(page: int, page_size: int):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    return page, page_size, (page - 1) * page_size


def list_query(table: str, cols: str, clauses: list[str], params: list, page: int, page_size: int, order_by: str = "id desc"):
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
    return {"page": page, "page_size": page_size, "total": total, "items": rows}


@app.get("/api/v1/health")
def health():
    row = fetch_one("select now() as server_time")
    return {"ok": True, "server_time": row["server_time"] if row else None}


@app.get("/api/v1/dashboard/summary")
def dashboard_summary():
    students = fetch_one("select count(*) as c from amilyhub.students")["c"]
    teachers = fetch_one("select count(*) as c from amilyhub.teachers")["c"]
    orders = fetch_one("select count(*) as c from amilyhub.orders")["c"]
    hcf = fetch_one("select count(*) as c from amilyhub.hour_cost_flows")["c"]
    income = fetch_one("select coalesce(sum(case when direction in ('收入','INCOME','IN') then amount_cents else 0 end),0) as s from amilyhub.income_expense")["s"]
    expense = fetch_one("select coalesce(sum(case when direction in ('支出','EXPENSE','OUT') then amount_cents else 0 end),0) as s from amilyhub.income_expense")["s"]
    return {
        "students": students,
        "teachers": teachers,
        "orders": orders,
        "hour_cost_flows": hcf,
        "income_cents": int(income or 0),
        "expense_cents": int(expense or 0),
    }


@app.get("/api/v1/students")
def list_students(
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    clauses, params = [], []
    if q:
        clauses.append("(name ilike %s or phone ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if status:
        clauses.append("status = %s")
        params.append(status)
    return list_query("students", "id, source_student_id, name, phone, gender, birthday, status, source_created_at", clauses, params, page, page_size)


@app.get("/api/v1/students/{source_student_id}")
def get_student(source_student_id: str):
    row = fetch_one("select id, source_student_id, name, phone, gender, birthday, status, source_created_at from amilyhub.students where source_student_id=%s", (source_student_id,))
    if not row:
        raise HTTPException(status_code=404, detail="student not found")
    return row


@app.get("/api/v1/teachers")
def list_teachers(q: str | None = Query(default=None), page: int = Query(default=1), page_size: int = Query(default=20)):
    clauses, params = [], []
    if q:
        clauses.append("(name ilike %s or phone ilike %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    return list_query("teachers", "id, source_teacher_id, name, phone, gender, last_month_lessons, current_month_lessons, total_finished_lessons", clauses, params, page, page_size)


@app.get("/api/v1/orders")
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
    return list_query("orders", "id, source_order_id, source_student_id, order_type, order_state, receivable_cents, received_cents, arrears_cents, source_created_at", clauses, params, page, page_size)


@app.get("/api/v1/orders/{source_order_id}")
def get_order(source_order_id: str):
    row = fetch_one("select * from amilyhub.orders where source_order_id=%s", (source_order_id,))
    if not row:
        raise HTTPException(status_code=404, detail="order not found")
    return row


@app.get("/api/v1/hour-cost-flows")
def list_hour_cost_flows(
    student_id: str | None = Query(default=None),
    teacher_id: str | None = Query(default=None),
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
    return list_query("hour_cost_flows", "id, source_id, source_student_id, source_teacher_id, source_class_id, source_course_id, cost_type, source_type, cost_hours, cost_amount_cents, checked_at, source_created_at", clauses, params, page, page_size)


@app.get("/api/v1/income-expense")
def list_income_expense(
    direction: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    clauses, params = [], []
    if direction:
        clauses.append("direction = %s")
        params.append(direction)
    return list_query("income_expense", "id, source_id, source_order_id, item_type, direction, amount_cents, operation_date, source_created_at", clauses, params, page, page_size)


@app.get("/api/v1/rollcalls")
def list_rollcalls(
    q: str | None = Query(default=None),
    page: int = Query(default=1),
    page_size: int = Query(default=50),
):
    clauses, params = [], []
    if q:
        clauses.append("(student_name ilike %s or teacher_name ilike %s or class_name ilike %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    return list_query("rollcalls", "id, source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_amount_cents", clauses, params, page, page_size)
