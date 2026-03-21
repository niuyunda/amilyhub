set search_path to amilyhub, public;

create table if not exists audit_logs (
  id bigserial primary key,
  operator text,
  role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_logs_resource on audit_logs(resource_type, resource_id);
