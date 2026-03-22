import json
from typing import Any

from ..core.errors import ApiError
from ..core.schema import calculate_cost_amount_cents
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager


def list_rollcalls(*, q: str | None, student_name: str | None, teacher_name: str | None, status: str | None, class_name: str | None, date: str | None, rollcall_date_start: str | None, rollcall_date_end: str | None, class_date_start: str | None, class_date_end: str | None, page: int, page_size: int) -> dict[str, Any]:
    page, page_size, offset = pager(page, page_size)
    clauses, params = [
        "position('点名学生' in coalesce(student_name,'')) = 0",
        "position('测试' in coalesce(student_name,'')) = 0",
        "position('Order Action' in coalesce(student_name,'')) = 0",
        "position('Renew Student' in coalesce(student_name,'')) = 0",
    ], []
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
    condition = f" where {' and '.join(clauses)}" if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.rollcalls {condition}", tuple(params))
    rows = fetch_rows(
        f"""
        select source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status,
               cost_amount_cents, coalesce((raw_json->>'teaching_hours')::numeric, 0) as teaching_hours,
               coalesce(raw_json->>'attendance_summary', '-') as attendance_summary,
               coalesce((raw_json->>'actual_students')::int, 0) as actual_students,
               coalesce((raw_json->>'total_students')::int, 0) as total_students,
               coalesce(raw_json->>'student_names', '-') as student_names
        from amilyhub.rollcalls
        {condition}
        order by rollcall_time desc, id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": int((total or {}).get("c", 0) or 0)}


def get_rollcall_detail(source_id: str) -> dict[str, Any]:
    row = fetch_one(
        """
        select source_row_hash, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, cost_amount_cents,
               coalesce((raw_json->>'teaching_hours')::numeric, 0) as teaching_hours, coalesce(raw_json->>'attendance_summary', '-') as attendance_summary,
               coalesce((raw_json->>'actual_students')::int, 0) as actual_students, coalesce((raw_json->>'total_students')::int, 0) as total_students,
               coalesce(raw_json->>'student_names', '-') as student_names, coalesce(raw_json->'students', '[]'::jsonb) as students, raw_json
        from amilyhub.rollcalls where source_row_hash=%s
        """,
        (source_id,),
    )
    if not row:
        raise ApiError(404, "ROLLCALL_NOT_FOUND", "rollcall not found")
    return row


def confirm_rollcall(source_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    row = fetch_one(
        "select source_row_hash, student_name, class_name, course_name, teacher_name, rollcall_time, class_time_range, status, raw_json from amilyhub.rollcalls where source_row_hash=%s",
        (source_id,),
    )
    if not row:
        raise ApiError(404, "ROLLCALL_NOT_FOUND", "rollcall not found")
    status = (payload.get("status") or row.get("status") or "正常").strip()
    operator = payload.get("operator") or "system"
    reason = payload.get("reason") or ""
    normal_statuses = {"正常", "已到", "出勤", "正常到课"}
    leave_statuses = {"请假"}
    absent_statuses = {"旷课"}
    revoke_statuses = {"撤销确认", "撤销", "取消确认"}
    flow_source_id = f"ROLLCALL_{source_id}"
    if status in revoke_statuses:
        with get_transaction_cursor() as cur:
            cur.execute("delete from amilyhub.hour_cost_flows where source_id=%s", (flow_source_id,))
            revoked = cur.rowcount > 0
            cur.execute("update amilyhub.rollcalls set status=%s where source_row_hash=%s", (status, source_id))
        return {"rollcall": source_id, "status": status, "revoked": revoked, "rollback": "deleted_hour_cost_flow", "idempotent_key": flow_source_id}
    if status in normal_statuses:
        cost_hours, cost_type = 1, "课消"
    elif status in leave_statuses:
        cost_hours, cost_type = 0, "请假"
    elif status in absent_statuses:
        cost_hours, cost_type = 1, "旷课课消"
    else:
        return {"rollcall": source_id, "status": status, "skipped": True}
    raw = row.get("raw_json") or {}
    student_id = raw.get("studentId") if isinstance(raw, dict) else None
    if not student_id:
        hit = fetch_one("select source_student_id from amilyhub.students where name=%s order by id desc limit 1", (row.get("student_name"),))
        student_id = (hit or {}).get("source_student_id")
    source_class_id = raw.get("classId") or raw.get("class_id") if isinstance(raw, dict) else None
    source_course_id = raw.get("courseId") or raw.get("course_id") if isinstance(raw, dict) else None
    cost_amount_cents = calculate_cost_amount_cents(source_class_id=source_class_id, source_course_id=source_course_id, class_time_range=row.get("class_time_range")) if cost_hours > 0 else 0
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
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            insert into amilyhub.hour_cost_flows
            (source_id, source_student_id, source_teacher_id, source_class_id, source_course_id, cost_type, source_type, cost_hours, cost_amount_cents, checked_at, raw_json)
            values (%s, %s, null, %s, %s, %s, %s, %s, %s, now(), %s::jsonb)
            on conflict (source_id) do update
              set source_student_id = excluded.source_student_id, source_class_id = excluded.source_class_id, source_course_id = excluded.source_course_id,
                  cost_type = excluded.cost_type, source_type = excluded.source_type, cost_hours = excluded.cost_hours,
                  cost_amount_cents = excluded.cost_amount_cents, raw_json = excluded.raw_json, checked_at = now()
            returning source_id, source_student_id, cost_hours, cost_amount_cents, checked_at
            """,
            (flow_source_id, student_id, source_class_id, source_course_id, cost_type, "ROLLCALL", cost_hours, cost_amount_cents, json.dumps(flow_raw, ensure_ascii=False, default=str)),
        )
        flow = cur.fetchone()
        flow_cols = [d.name for d in cur.description]
        cur.execute("update amilyhub.rollcalls set status=%s where source_row_hash=%s", (status, source_id))
    return {"rollcall": source_id, "status": status, "hour_cost_flow": dict(zip(flow_cols, flow)), "cost_amount_cents": cost_amount_cents, "idempotent_key": flow_source_id}
