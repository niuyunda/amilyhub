from __future__ import annotations

from pathlib import Path

from ..core.runtime import is_initialized, mark_initialized
from ..db import fetch_one, fetch_rows, get_transaction_cursor


def ensure_new_tables() -> None:
    if is_initialized("new_tables"):
        return
    migration_path = Path(__file__).resolve().parents[1] / "migrations" / "add_student_class_fields.sql"
    if not migration_path.exists():
        return
    with migration_path.open("r", encoding="utf-8") as handle:
        sql = handle.read()
    with get_transaction_cursor() as cur:
        cur.execute(sql)
    ensure_rooms_table()
    mark_initialized("new_tables")


def ensure_courses_table() -> None:
    if is_initialized("courses"):
        return
    with get_transaction_cursor() as cur:
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
    mark_initialized("courses")


def ensure_order_events_table() -> None:
    if is_initialized("order_events"):
        return
    with get_transaction_cursor() as cur:
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
    mark_initialized("order_events")


def ensure_schedule_events_table() -> None:
    if is_initialized("schedule_events"):
        return
    with get_transaction_cursor() as cur:
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
        cur.execute(
            "create index if not exists idx_schedule_events_teacher_time on amilyhub.schedule_events(teacher_name, start_time, end_time)"
        )
    mark_initialized("schedule_events")


def ensure_rooms_table() -> None:
    if is_initialized("rooms"):
        return
    with get_transaction_cursor() as cur:
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
    mark_initialized("rooms")


def ensure_classes_table() -> None:
    if is_initialized("classes"):
        return
    ensure_new_tables()
    mark_initialized("classes")


def calculate_cost_amount_cents(
    source_class_id: str | None,
    source_course_id: str | None,
    class_time_range: str | None,
) -> int:
    course_id: str | None = None
    if source_class_id:
        cls = fetch_one("select course_id from amilyhub.classes where source_class_id=%s", (source_class_id,))
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
    if price_per_hour_cents == 0:
        pricing_items = course.get("pricing_items") or []
        if pricing_items and isinstance(pricing_items, list):
            first_item = pricing_items[0]
            unit_price = float(first_item.get("price") or 0)
            price_per_hour_cents = int(unit_price * 100)
    if price_per_hour_cents == 0:
        return 0
    course_hours = 1.0
    if class_time_range:
        import re

        match = re.search(r"(\d+):(\d+)-(\d+):(\d+)", str(class_time_range))
        if match:
            sh, sm, eh, em = int(match[1]), int(match[2]), int(match[3]), int(match[4])
            course_hours = (eh * 60 + em - sh * 60 - sm) / 60.0
            if course_hours <= 0:
                course_hours = 1.0
    return int(price_per_hour_cents * course_hours)
