# Runbook: PostgreSQL via Docker Compose (Local)

## Purpose
Provision a local PostgreSQL instance for AmilyHub migration/import work with secrets stored in local `.env` and excluded from git.

## Files
- Compose: `infra/docker-compose.dev.yml`
- Env template (committed): `infra/.env.example`
- Env real values (NOT committed): `infra/.env`
- Git ignore: `.gitignore` (includes `infra/.env`)

## 1) Configure credentials
Copy template and edit local values:

```bash
cp infra/.env.example infra/.env
```

Expected keys:
- `PG_CONTAINER_NAME`
- `PG_PORT`
- `PG_USER`
- `PG_PASSWORD`
- `PG_DB`

Current requested values:
- user: `amily`
- password: `alpha128128`
- db: `amilyhub`
- port: `55432`

## 2) Start PostgreSQL container

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d
```

Check container health:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml ps
```

## 3) Connection string for app/import

```text
postgresql://amily:alpha128128@localhost:55432/amilyhub
```

Use as env var:

```bash
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
```

## 4) Run schema + import loader

```bash
cd apps/api
uv run scripts/load_raw_to_postgres.py
```

(Requires `DATABASE_URL` env var set.)

## 5) Verify imported row counts

```sql
select 'teachers', count(*) from amilyhub.teachers
union all select 'students', count(*) from amilyhub.students
union all select 'orders', count(*) from amilyhub.orders
union all select 'income_expense', count(*) from amilyhub.income_expense
union all select 'hour_cost_flows', count(*) from amilyhub.hour_cost_flows
union all select 'rollcalls', count(*) from amilyhub.rollcalls;
```

## 6) Stop / reset
Stop only:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down
```

Stop and delete data volume:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down -v
```

## Security notes
- Do NOT commit `infra/.env`.
- Use `.env.example` for non-secret defaults only.
- Prefer rotating password when moving beyond local/dev usage.
