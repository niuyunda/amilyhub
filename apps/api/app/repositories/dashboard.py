from ..db import fetch_one
from ..utils.pagination import as_int


def fetch_dashboard_summary() -> dict[str, int]:
    base_student_where = (
        "coalesce(name,'') not in ('Order Student','P0 Student') "
        "and position('测试' in coalesce(name,'')) = 0 "
        "and coalesce(phone,'') <> '' and coalesce(phone,'') <> '13900139000'"
    )
    students = as_int(fetch_one(f"select count(*) as c from amilyhub.students where {base_student_where}")["c"])
    active_students = as_int(
        fetch_one(
            f"select count(*) as c from amilyhub.students "
            f"where {base_student_where} and status in ('active','ACTIVE','在读','NORMAL','LEARNING')"
        )["c"]
    )
    teachers = as_int(fetch_one("select count(*) as c from amilyhub.teachers")["c"])
    orders = as_int(fetch_one("select count(*) as c from amilyhub.orders")["c"])
    hour_cost_flows = as_int(fetch_one("select count(*) as c from amilyhub.hour_cost_flows")["c"])
    rollcalls = as_int(fetch_one("select count(*) as c from amilyhub.rollcalls")["c"])
    income_expense = as_int(fetch_one("select count(*) as c from amilyhub.income_expense")["c"])

    month_start = "date_trunc('month', now() at time zone 'Pacific/Auckland')"
    month_filter = f"operation_date >= {month_start}"
    hcf_month_filter = f"coalesce(checked_at, source_created_at, created_at) >= {month_start}"

    income = as_int(
        fetch_one(
            f"select coalesce(sum(case when direction in ('收入','INCOME','IN') then amount_cents else 0 end),0) as s "
            f"from amilyhub.income_expense where {month_filter}"
        )["s"]
    )
    expense = as_int(
        fetch_one(
            f"select coalesce(sum(case when direction in ('支出','EXPENSE','OUT') then amount_cents else 0 end),0) as s "
            f"from amilyhub.income_expense where {month_filter}"
        )["s"]
    )
    monthly_classes = as_int(
        fetch_one(
            f"""
            select count(distinct coalesce(nullif(raw_json->>'classId',''), source_class_id)) as c
            from amilyhub.hour_cost_flows
            where {hcf_month_filter}
              and coalesce(nullif(raw_json->>'classId',''), source_class_id) is not null
              and coalesce(nullif(raw_json->>'classId',''), source_class_id) <> ''
            """
        )["c"]
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
        "students": students,
        "active_students": active_students,
        "teachers": teachers,
        "orders": orders,
        "hour_cost_flows": hour_cost_flows,
        "rollcalls": rollcalls,
        "income_expense": income_expense,
        "monthly_classes": monthly_classes,
        "income_cents": income,
        "expense_cents": expense,
        "net_income_cents": income - expense,
        "receivable_cents": as_int(order_money["receivable"]),
        "received_cents": as_int(order_money["received"]),
        "arrears_cents": as_int(order_money["arrears"]),
    }
