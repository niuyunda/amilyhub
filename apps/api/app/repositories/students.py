import json
import random
import time
from typing import Any

from ..core.errors import ApiError
from ..core.schema import ensure_new_tables
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager
from ..utils.students import assert_student_exists


def list_students(*, q: str | None, status: str | None, source: str | None, age_range: str | None, page: int, page_size: int) -> dict[str, Any]:
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
        parts = age_range.split("-")
        if len(parts) == 2:
            try:
                lo, hi = int(parts[0].strip()), int(parts[1].strip())
                clauses.append("extract(year from age(current_date, s.birthday))::int between %s and %s")
                params.extend([lo, hi])
            except ValueError:
                pass
    condition = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.students s {condition}", tuple(params))["c"]
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
            coalesce(sum(coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)), 0) as purchased_lessons
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
          s.source,
          s.grade,
          s.school,
          s.tags as tags,
          s.follow_up_person as follow_up_person,
          s.edu_manager as edu_manager,
          s.wechat_bound as wechat_bound,
          s.face_captured as face_captured
        from amilyhub.students s
        left join latest_hcf l on l.source_student_id = s.source_student_id
        left join consumed c on c.source_student_id = s.source_student_id
        left join purchased p on p.source_student_id = s.source_student_id
        {condition}
        order by s.id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}


def get_student(source_student_id: str) -> dict[str, Any]:
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
    return row


def get_student_profile(source_student_id: str) -> dict[str, Any]:
    student = get_student(source_student_id)
    courses = fetch_rows(
        """
        with h as (
          select coalesce(raw_json->>'businessNo', '') as business_no,
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
              when coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0) > 0 then coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
              when coalesce(o.received_cents, 0) > 0 and position('48节课时包' in coalesce(pi->>'itemsInfo', '')) > 0 then 3
              else 0
            end
          )::numeric as gift_lessons,
          (coalesce(h.consumed_purchase, 0) + coalesce(h.consumed_gift, 0))::numeric as consumed_lessons,
          0::numeric as transfer_lessons,
          greatest(((case
              when coalesce(o.received_cents, 0) = 0 and position('送' in coalesce(pi->>'itemsInfo', '')) > 0 then 0
              else coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
            end)
            + case
              when position('送一节' in coalesce(pi->>'itemsInfo', '')) > 0 then 1
              when coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0) > 0 then coalesce((regexp_match(coalesce(pi->>'itemsInfo', ''), '送([0-9]+(?:\\.[0-9]+)?)节'))[1]::numeric, 0)
              when coalesce(o.received_cents, 0) > 0 and position('48节课时包' in coalesce(pi->>'itemsInfo', '')) > 0 then 3
              else 0
            end - (coalesce(h.consumed_purchase, 0) + coalesce(h.consumed_gift, 0))), 0)::numeric as remain_lessons
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
        select source_row_hash, class_name, course_name, teacher_name, rollcall_time, status
        from amilyhub.rollcalls
        where coalesce(raw_json->>'studentId','')=%s
           or coalesce(raw_json->>'studentName','')=coalesce(%s,'')
        order by id desc
        limit 50
        """,
        (source_student_id, student.get("name")),
    )
    payments = fetch_rows(
        """
        select ie.source_id, ie.source_order_id, ie.item_type, ie.direction, ie.amount_cents, ie.operation_date, ie.source_created_at
        from amilyhub.income_expense ie
        where ie.source_order_id in (select o.source_order_id from amilyhub.orders o where o.source_student_id=%s)
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
    return {"student": student, "courses": courses, "consumption": consumption, "rollcalls": rollcalls, "payments": payments, "order_logs": order_logs}


def create_student(payload: dict[str, Any]) -> dict[str, Any]:
    ensure_new_tables()
    source_student_id = payload.get("source_student_id")
    with get_transaction_cursor() as cur:
        if source_student_id:
            cur.execute("select 1 from amilyhub.students where source_student_id=%s", (source_student_id,))
            if cur.fetchone():
                raise ApiError(409, "STUDENT_EXISTS", "student already exists")
        else:
            for _ in range(10):
                candidate = f"STU{int(time.time() * 1000)}{random.randint(100, 999)}"
                cur.execute("select 1 from amilyhub.students where source_student_id=%s", (candidate,))
                if not cur.fetchone():
                    source_student_id = candidate
                    break
            if not source_student_id:
                raise ApiError(500, "STUDENT_ID_GENERATE_FAILED", "failed to generate student id")
        if payload.get("name") and payload.get("phone"):
            cur.execute(
                """
                select source_student_id from amilyhub.students
                where lower(coalesce(name, '')) = lower(%s) and coalesce(phone, '') = %s
                limit 1
                """,
                (payload["name"], payload["phone"]),
            )
            hit = cur.fetchone()
            if hit:
                raise ApiError(409, "STUDENT_EXISTS", f"student already exists: {hit[0]}")
        normalized = {**payload, "source_student_id": source_student_id, "status": payload.get("status") or "在读"}
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
                payload.get("name"),
                payload.get("phone"),
                payload.get("gender"),
                payload.get("birthday"),
                normalized["status"],
                payload.get("source"),
                payload.get("grade"),
                payload.get("school"),
                payload.get("tags"),
                payload.get("follow_up_person"),
                payload.get("edu_manager"),
                payload.get("wechat_bound") if payload.get("wechat_bound") is not None else False,
                payload.get("face_captured") if payload.get("face_captured") is not None else False,
                json.dumps(normalized, ensure_ascii=False, default=str),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_student(source_student_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    ensure_new_tables()
    if not updates:
        raise ApiError(422, "VALIDATION_ERROR", "at least one updatable field is required")
    tags_val = updates.pop("tags", None)
    set_parts = [f"{field}=%s" for field in updates]
    values = list(updates.values())
    if tags_val is not None:
        set_parts.append("tags=%s")
        values.append(tags_val)
        updates["tags"] = tags_val
    set_parts.append("raw_json=coalesce(raw_json, '{}'::jsonb) || %s::jsonb")
    values.append(json.dumps(updates, ensure_ascii=False, default=str))
    values.append(source_student_id)
    with get_transaction_cursor() as cur:
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
    return dict(zip(cols, row))


def delete_student(source_student_id: str, cascade: bool) -> dict[str, Any]:
    with get_transaction_cursor() as cur:
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
    return {"source_student_id": source_student_id, "cascade": cascade}


def enroll_student(source_student_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    assert_student_exists(source_student_id)
    source_order_id = f"ODR{int(time.time() * 1000)}{random.randint(100,999)}"
    raw_json = {
        "source_order_id": source_order_id,
        "courseName": payload["course_name"],
        "purchaseItems": [{"itemsInfo": payload["course_name"]}],
        "orderType": payload.get("order_type", "报名"),
    }
    with get_transaction_cursor() as cur:
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
                payload.get("order_type", "报名"),
                "已支付" if payload.get("arrears_cents", 0) == 0 else "待支付",
                payload.get("receivable_cents", 0),
                payload.get("received_cents", 0),
                payload.get("arrears_cents", 0),
                json.dumps(raw_json, ensure_ascii=False),
            ),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))
