# DB Schema v1 (PostgreSQL)

Schema name: `amilyhub`

Core tables:
- `teachers`
- `students`
- `orders`
- `income_expense`
- `hour_cost_flows`
- `rollcalls`
- `import_runs` (audit/import bookkeeping)

Design principles:
1. Source-first migration: each record keeps `source_*_id` and `raw_json`.
2. Idempotent imports: unique keys on source IDs + upsert behavior.
3. Money normalized to cents while preserving raw payload.
4. Rollcalls are imported from XLS fallback export.

SQL file:
- `apps/api/schema/001_init.sql`
