# DB Import Result (2026-03-20)

## Environment
- Runtime: Docker Compose local PostgreSQL
- Compose file: `infra/docker-compose.dev.yml`
- Env file (local, gitignored): `infra/.env`
- Credentials used:
  - user: `amily`
  - password: `alpha128128`
  - db: `amilyhub`
  - port: `55432`

## Execution
1. Recreated DB container and volume to ensure fresh credentials.
2. Applied schema SQL from `apps/api/schema/001_init.sql`.
3. Imported raw export bundle with `apps/api/scripts/load_raw_to_postgres.py`.

## Final Row Counts
- `amilyhub.teachers`: 8
- `amilyhub.students`: 327
- `amilyhub.orders`: 1629
- `amilyhub.income_expense`: 1512
- `amilyhub.hour_cost_flows`: 43736
- `amilyhub.rollcalls`: 465

## Notes
- `students` count is 327 (includes one test/migration record from earlier probing).
- Import script is idempotent for main datasets via source-id upsert.
- `rollcalls` source comes from browser async export xls fallback.
