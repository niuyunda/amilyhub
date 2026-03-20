import os
from datetime import datetime, timezone
import psycopg

DB = os.getenv("DATABASE_URL")
if not DB:
    raise SystemExit("Set DATABASE_URL, e.g. postgresql://amily:alpha128128@localhost:55432/amilyhub")


def _to_dt_sql_expr(field: str) -> str:
    return f"""
    case
      when coalesce(raw_json->>'{field}', '') = '' then null
      when (raw_json->>'{field}') ~ '^\\d+(\\.\\d+)?$' then to_timestamp(((raw_json->>'{field}')::numeric / case when (raw_json->>'{field}')::numeric > 100000000000 then 1000 else 1 end))
      else null
    end
    """


def run():
    with psycopg.connect(DB) as conn:
        with conn.cursor() as cur:
            # 1) students: normalize source_student_id from raw payload
            cur.execute(
                """
                update amilyhub.students
                set name = coalesce(nullif(raw_json->'studentBasicVO'->>'name', ''), name),
                    phone = coalesce(nullif(raw_json->'studentBasicVO'->>'phone', ''), phone),
                    gender = coalesce(nullif(raw_json->'studentBasicVO'->>'genderEnum', ''), gender),
                    status = coalesce(
                      nullif(raw_json->'studentBasicVO'->>'statusEnum', ''),
                      nullif(raw_json->>'statusEnum', ''),
                      nullif(raw_json->>'status', ''),
                      status
                    )
                where raw_json is not null
                """
            )
            print("students relinked:", cur.rowcount)

            # 2) orders: linkage comes from raw_json.studentVO.studentId + businessNo
            cur.execute(
                """
                update amilyhub.orders
                set source_order_id = case
                      when source_order_id is null or source_order_id = '' then coalesce(nullif(raw_json->>'businessNo', ''), nullif(raw_json->>'id', ''), source_order_id)
                      else source_order_id
                    end,
                    source_student_id = coalesce(
                    nullif(raw_json->'studentVO'->>'studentId', ''),
                    nullif(raw_json->>'studentId', ''),
                    source_student_id
                ),
                order_type = coalesce(nullif(raw_json->>'businessType', ''), order_type),
                order_state = coalesce(nullif(raw_json->>'businessState', ''), order_state),
                receivable_cents = coalesce(
                    (case when raw_json ? 'shouldAmount' then ((raw_json->>'shouldAmount')::numeric * 100)::bigint end),
                    receivable_cents
                ),
                received_cents = coalesce(
                    (case when raw_json ? 'paidAmount' then ((raw_json->>'paidAmount')::numeric * 100)::bigint end),
                    received_cents
                ),
                arrears_cents = coalesce(
                    (case when raw_json ? 'unpaidAmount' then ((raw_json->>'unpaidAmount')::numeric * 100)::bigint end),
                    arrears_cents
                )
                where raw_json is not null
                """
            )
            print("orders relinked:", cur.rowcount)

            # 3) hour cost flows: student linkage
            cur.execute(
                f"""
                update amilyhub.hour_cost_flows
                set source_student_id = coalesce(nullif(raw_json->>'studentId', ''), source_student_id),
                    source_teacher_id = coalesce(nullif(raw_json->>'teacherId', ''), source_teacher_id),
                    source_class_id = coalesce(nullif(raw_json->>'classId', ''), source_class_id),
                    source_course_id = coalesce(nullif(raw_json->>'courseId', ''), source_course_id),
                    cost_type = coalesce(nullif(raw_json->>'costType', ''), cost_type),
                    source_type = coalesce(nullif(raw_json->>'sourceType', ''), source_type),
                    checked_at = coalesce({_to_dt_sql_expr('checkedDate')}, {_to_dt_sql_expr('checkedAt')}, checked_at),
                    source_created_at = coalesce({_to_dt_sql_expr('created')}, {_to_dt_sql_expr('createdAt')}, source_created_at)
                where raw_json is not null
                """
            )
            print("hour_cost_flows relinked:", cur.rowcount)

            # 4) income_expense: link to order businessNo
            cur.execute(
                """
                update amilyhub.income_expense
                set source_order_id = coalesce(
                    nullif(raw_json->>'businessNo', ''),
                    nullif(raw_json->>'orderNo', ''),
                    source_order_id
                ),
                item_type = coalesce(nullif(raw_json->>'itemName', ''), item_type),
                direction = coalesce(nullif(raw_json->>'type', ''), direction)
                where raw_json is not null
                """
            )
            print("income_expense relinked:", cur.rowcount)

            # 5) backfill missing students from order payloads
            cur.execute(
                """
                insert into amilyhub.students(source_student_id, name, phone, status, raw_json)
                select distinct
                  raw_json->'studentVO'->>'studentId' as source_student_id,
                  nullif(raw_json->'studentVO'->>'name', '') as name,
                  nullif(raw_json->'studentVO'->>'phone', '') as phone,
                  nullif(raw_json->'studentVO'->>'statusEnum', '') as status,
                  jsonb_build_object('from', 'orders.studentVO', 'order_no', raw_json->>'businessNo', 'studentVO', raw_json->'studentVO') as raw_json
                from amilyhub.orders
                where coalesce(raw_json->'studentVO'->>'studentId', '') <> ''
                on conflict (source_student_id) do nothing
                """
            )
            print("students backfilled from orders:", cur.rowcount)

            # 6) backfill missing students from hour_cost_flows payloads
            cur.execute(
                """
                insert into amilyhub.students(source_student_id, name, raw_json)
                select distinct
                  raw_json->>'studentId' as source_student_id,
                  nullif(raw_json->>'studentName', '') as name,
                  jsonb_build_object('from', 'hour_cost_flows', 'source_id', raw_json->>'id', 'studentId', raw_json->>'studentId', 'studentName', raw_json->>'studentName') as raw_json
                from amilyhub.hour_cost_flows h
                where coalesce(raw_json->>'studentId', '') <> ''
                on conflict (source_student_id) do nothing
                """
            )
            print("students backfilled from hour_cost_flows:", cur.rowcount)

            # 7) rollcalls invalid for now: clear table
            cur.execute("truncate table amilyhub.rollcalls")
            print("rollcalls truncated")

        conn.commit()


if __name__ == "__main__":
    run()
