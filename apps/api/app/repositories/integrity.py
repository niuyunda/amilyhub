from ..db import fetch_one


CHECKS: list[tuple[str, str, str | None, str, str]] = [
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


def run_integrity_checks() -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for kind, table, field, sql, note in CHECKS:
        count = int((fetch_one(sql) or {}).get("c", 0) or 0)
        if count > 0:
            results.append({"kind": kind, "table": table, "field": field, "count": count, "note": note})
    return results
