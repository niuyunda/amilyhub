-- AmilyHub v1 schema (source-first migration)
create schema if not exists amilyhub;
set search_path to amilyhub, public;

create table if not exists teachers (
  id bigserial primary key,
  source_teacher_id text unique not null,
  source_admin_id text,
  name text,
  phone text,
  gender text,
  last_month_lessons numeric,
  current_month_lessons numeric,
  total_finished_lessons numeric,
  raw_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists students (
  id bigserial primary key,
  source_student_id text unique not null,
  name text,
  phone text,
  gender text,
  birthday date,
  status text,
  source_created_at timestamptz,
  raw_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists orders (
  id bigserial primary key,
  source_order_id text unique not null,
  source_student_id text,
  order_type text,
  order_state text,
  receivable_cents bigint,
  received_cents bigint,
  arrears_cents bigint,
  source_created_at timestamptz,
  source_paid_at timestamptz,
  raw_json jsonb not null,
  created_at timestamptz default now()
);
create index if not exists idx_orders_student on orders(source_student_id);

create table if not exists income_expense (
  id bigserial primary key,
  source_id text unique not null,
  source_order_id text,
  item_type text,
  direction text,
  amount_cents bigint,
  operation_date date,
  source_created_at timestamptz,
  raw_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists hour_cost_flows (
  id bigserial primary key,
  source_id text unique not null,
  source_student_id text,
  source_teacher_id text,
  source_class_id text,
  source_course_id text,
  cost_type text,
  source_type text,
  cost_hours numeric,
  cost_amount_cents bigint,
  checked_at timestamptz,
  source_created_at timestamptz,
  raw_json jsonb not null,
  created_at timestamptz default now()
);
create index if not exists idx_hcf_student on hour_cost_flows(source_student_id);

create table if not exists rollcalls (
  id bigserial primary key,
  source_row_hash text unique not null,
  student_name text,
  class_name text,
  course_name text,
  teacher_name text,
  rollcall_time text,
  class_time_range text,
  status text,
  cost_amount_cents bigint,
  raw_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists import_runs (
  id bigserial primary key,
  run_key text not null,
  dataset text not null,
  rows_loaded int not null default 0,
  status text not null,
  detail jsonb,
  created_at timestamptz default now()
);
