-- P0 minimal closure: orders events + schedule plans
set search_path to amilyhub, public;

create table if not exists order_events (
  id bigserial primary key,
  source_order_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_order_events_order on order_events(source_order_id);

create table if not exists schedule_events (
  id bigserial primary key,
  class_name text not null,
  teacher_name text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  room_name text,
  status text not null default 'planned',
  source_course_id text,
  source_class_id text,
  note text,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_schedule_events_teacher_time on schedule_events(teacher_name, start_time, end_time);

-- TODO(P0-next): enrich event_type coverage to void/refund and add richer audit fields.
