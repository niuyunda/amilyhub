import json
from typing import Any

from ..core.errors import ApiError
from ..core.schema import ensure_classes_table
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager


def list_classes(*, q: str | None, teacher_name: str | None, status: str | None, class_type: str | None, page: int, page_size: int) -> dict[str, Any]:
    ensure_classes_table()
    page, page_size, offset = pager(page, page_size)
    hcf_clauses = [
        "h.source_class_id IS NOT NULL",
        "coalesce(nullif(h.raw_json->>'className', ''), '') <> ''",
        "position('测试' in coalesce(h.raw_json->>'className', '')) = 0",
    ]
    hcf_params: list[Any] = []
    if q:
        hcf_clauses.append("(coalesce(nullif(h.raw_json->>'className', ''), '') ilike %s OR coalesce(nullif(h.raw_json->>'courseName', ''), '') ilike %s)")
        hcf_params.extend([f"%{q}%", f"%{q}%"])
    if teacher_name:
        hcf_clauses.append("coalesce(nullif(h.raw_json->>'teacherNames', ''), '') ilike %s")
        hcf_params.append(f"%{teacher_name}%")
    res_clauses, res_params = [], []
    if status:
        res_clauses.append("status = %s")
        res_params.append(status)
    if class_type:
        res_clauses.append("is_one_on_one = true" if class_type == "一对一" else "is_one_on_one = false")
    hcf_cond = " and ".join(hcf_clauses)
    res_cond = f" where {' and '.join(res_clauses)} " if res_clauses else ""
    total = int((fetch_one(f"select count(DISTINCT h.source_class_id) as c from amilyhub.hour_cost_flows h where {hcf_cond}", tuple(hcf_params)) or {}).get("c", 0) or 0)
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
        total = int((fetch_one(f"select count(*) as c from amilyhub.classes {cond2}", tuple(params2)) or {}).get("c", 0) or 0)
        rows = fetch_rows(
            f"""
            select source_class_id as id, name, coalesce(type, '班课') as class_type, coalesce(campus, '-') as campus, capacity,
                   coalesce(description, '') as description, coalesce(start_date, current_date) as start_date,
                   coalesce(end_date, current_date) as end_date, coalesce(status, '开班中') as status, created_at, updated_at,
                   '-' as course_name, '-' as teacher_name, 0 as student_count, false as is_one_on_one
            from amilyhub.classes
            {cond2}
            order by source_class_id desc
            limit %s offset %s
            """,
            tuple(params2 + [page_size, offset]),
        )
        return {"rows": rows, "page": page, "page_size": page_size, "total": total}
    rows = fetch_rows(
        f"""
        with class_base as (
          select h.source_class_id, coalesce(nullif(h.raw_json->>'className', ''), '-') as name,
                 coalesce(nullif(h.raw_json->>'courseName', ''), '-') as course_name,
                 coalesce(nullif(h.raw_json->>'classroomName', ''), '-') as classroom_name,
                 coalesce(nullif(h.raw_json->>'classroomId', ''), '-') as classroom_id,
                 coalesce(nullif(h.raw_json->>'teacherNames', ''), (SELECT t.name FROM amilyhub.teachers t WHERE t.source_teacher_id = h.source_teacher_id LIMIT 1), '-') as teacher_name,
                 (position('一对一' in coalesce(h.raw_json->>'className', '')) > 0 OR position('1对1' in coalesce(h.raw_json->>'className', '')) > 0 OR position('1V1' in coalesce(h.raw_json->>'className', '')) > 0 OR position('1V4' in coalesce(h.raw_json->>'className', '')) > 0 OR position('1v1' in lower(coalesce(h.raw_json->>'className', ''))) > 0 OR position('1v4' in lower(coalesce(h.raw_json->>'className', ''))) > 0 OR position('1v2' in lower(coalesce(h.raw_json->>'className', ''))) > 0) as is_one_on_one,
                 max(h.checked_at) as latest_check
          from amilyhub.hour_cost_flows h
          where {hcf_cond}
          group by h.source_class_id, h.raw_json->>'className', h.raw_json->>'courseName', h.raw_json->>'teacherNames', h.raw_json->>'classroomName', h.raw_json->>'classroomId', h.source_teacher_id
        ), student_counts as (
          select h.source_class_id, count(DISTINCT h.source_student_id) as student_count
          from amilyhub.hour_cost_flows h where {hcf_cond} group by h.source_class_id
        ), class_status as (
          select h.source_class_id,
                 case when max(case when s.status in ('NORMAL','在读','active','ACTIVE','LEARNING') then 1 else 0 end) = 1 then '开班中' else '已结班' end as status
          from amilyhub.hour_cost_flows h
          left join amilyhub.students s on s.source_student_id = h.source_student_id
          where {hcf_cond}
          group by h.source_class_id
        )
        select cb.source_class_id as id, cb.name, cb.course_name, cb.teacher_name, cb.classroom_name, coalesce(sc.student_count, 0) as student_count,
               coalesce(cs.status, '开班中') as status, case when cb.is_one_on_one then '一对一' else '班课' end as class_type,
               0 as capacity, cb.source_class_id as source_class_id, '-' as campus, '-' as description, current_date as start_date,
               current_date as end_date, now() as created_at, now() as updated_at
        from class_base cb
        left join student_counts sc on sc.source_class_id = cb.source_class_id
        left join class_status cs on cs.source_class_id = cb.source_class_id
        {res_cond}
        order by cb.source_class_id desc
        limit %s offset %s
        """,
        tuple(hcf_params + res_params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}


def create_class(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_classes_table()
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (payload["source_class_id"],))
        if cur.fetchone():
            raise ApiError(409, "CLASS_EXISTS", "class already exists")
        cur.execute(
            """
            insert into amilyhub.classes
            (source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning id, source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status, created_at, updated_at
            """,
            (payload["source_class_id"], payload["name"], payload.get("type", "班课"), payload.get("course_id"), payload.get("teacher_id"), payload.get("campus", ""), payload.get("capacity", 0), payload.get("description", ""), payload.get("start_date"), payload.get("end_date"), payload.get("status", "开班中")),
        )
        row = cur.fetchone()
        return dict(zip([d.name for d in cur.description], row))


def update_class(class_id: int, updates: dict[str, Any]) -> dict[str, Any]:
    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values()) + [class_id]
    with get_transaction_cursor() as cur:
        cur.execute(
            f"""
            update amilyhub.classes
            set {', '.join(set_parts)}, updated_at=now()
            where source_class_id=%s
            returning id, source_class_id, name, type, course_id, teacher_id, campus, capacity, description, start_date, end_date, status, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
        return dict(zip([d.name for d in cur.description], row))


def delete_class(class_id: int) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
        cur.execute("delete from amilyhub.classes where source_class_id=%s returning source_class_id", (class_id,))
        row = cur.fetchone()
        if not row:
            raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
    return {"source_class_id": row[0]}


def add_student_to_class(class_id: int, student_id: str) -> dict[str, Any]:
    ensure_classes_table()
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (class_id,))
        if not cur.fetchone():
            raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
        cur.execute("select 1 from amilyhub.students where source_student_id=%s", (student_id,))
        if not cur.fetchone():
            raise ApiError(404, "STUDENT_NOT_FOUND", "student not found")
        cur.execute("select raw_json from amilyhub.classes where source_class_id=%s", (class_id,))
        existing = cur.fetchone()
        enrolled_students: list[str] = []
        if existing and existing[0]:
            data = existing[0] if isinstance(existing[0], dict) else json.loads(existing[0])
            enrolled_students = data.get("enrolled_students", [])
        if student_id not in enrolled_students:
            enrolled_students.append(student_id)
            cur.execute(
                """
                update amilyhub.classes
                set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb, updated_at=now()
                where source_class_id=%s
                """,
                (json.dumps({"enrolled_students": enrolled_students}, ensure_ascii=False), class_id),
            )
    return {"class_id": class_id, "student_id": student_id}


def remove_student_from_class(class_id: int, student_id: str) -> dict[str, Any]:
    ensure_classes_table()
    with get_transaction_cursor() as cur:
        cur.execute("select 1 from amilyhub.classes where source_class_id=%s", (class_id,))
        if not cur.fetchone():
            raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
        cur.execute("select raw_json from amilyhub.classes where source_class_id=%s", (class_id,))
        existing = cur.fetchone()
        if existing and existing[0]:
            data = existing[0] if isinstance(existing[0], dict) else json.loads(existing[0])
            enrolled_students = [value for value in data.get("enrolled_students", []) if value != student_id]
            cur.execute(
                """
                update amilyhub.classes
                set raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb, updated_at=now()
                where source_class_id=%s
                """,
                (json.dumps({"enrolled_students": enrolled_students}, ensure_ascii=False), class_id),
            )
    return {"class_id": class_id, "student_id": student_id}


def get_class_profile(class_id: str) -> dict[str, Any]:
    class_info = fetch_one(
        """
        with base as (
          select coalesce(raw_json->>'classId','') as class_id, coalesce(raw_json->>'className','-') as class_name,
                 coalesce(raw_json->>'courseName','-') as course_name, coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name,
                 coalesce((raw_json->>'classEndDate')::bigint, 0) as class_end_ms, coalesce((raw_json->>'totalNumber')::int, 0) as total_number,
                 checked_at as rollcall_time
          from amilyhub.hour_cost_flows where coalesce(raw_json->>'classId','')=%s
        )
        select class_id as id, max(class_name) as name, max(course_name) as course_name, max(teacher_name) as teacher_name,
               case when position('一对一' in max(class_name)) > 0 or position('1v1' in lower(max(class_name))) > 0 or position('1对1' in max(class_name)) > 0 then '一对一' else '班课' end as class_type,
               max(total_number) as student_count, max(total_number) as capacity,
               case when max(class_end_ms) > (extract(epoch from now()) * 1000)::bigint then '开班中' else '已结班' end as status,
               max(rollcall_time) as latest_rollcall_time
        from base group by class_id
        """,
        (class_id,),
    )
    if not class_info:
        raise ApiError(404, "CLASS_NOT_FOUND", "class not found")
    schedules = fetch_rows(
        """
        select source_id as id, coalesce(raw_json->>'timeRange', '-') as class_time_range, checked_at as rollcall_time,
               coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name,
               coalesce(raw_json->>'rollCallStateDesc', '-') as status
        from amilyhub.hour_cost_flows where coalesce(raw_json->>'classId','')=%s
        order by checked_at desc nulls last, id desc limit 50
        """,
        (class_id,),
    )
    students = fetch_rows(
        """
        with s as (
          select coalesce(raw_json->>'studentId','') as student_id, max(coalesce(raw_json->>'studentName', '-')) as student_name,
                 max(coalesce(raw_json->>'rollCallStateDesc', '-')) as latest_status, max(checked_at) as latest_time, count(*) as class_count
          from amilyhub.hour_cost_flows
          where coalesce(raw_json->>'classId','')=%s and coalesce(raw_json->>'studentId','') <> ''
          group by coalesce(raw_json->>'studentId','')
        )
        select student_id, student_name, latest_status, latest_time, class_count from s order by latest_time desc nulls last
        """,
        (class_id,),
    )
    attendance = fetch_rows(
        """
        select source_id as id, coalesce(raw_json->>'studentName', '-') as student_name,
               coalesce(raw_json->>'teacherNames', raw_json->>'teacherName', '-') as teacher_name, checked_at as rollcall_time,
               coalesce(raw_json->>'rollCallStateDesc', '-') as status, coalesce(raw_json->>'timeRange', '-') as class_time_range
        from amilyhub.hour_cost_flows where coalesce(raw_json->>'classId','')=%s
        order by checked_at desc nulls last, id desc limit 100
        """,
        (class_id,),
    )
    return {"class": class_info, "schedules": schedules, "students": students, "attendance": attendance}
