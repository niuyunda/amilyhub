# Current Status

## Summary
- Export phase completed and consolidated.
- PostgreSQL local container provisioned via Docker Compose.
- Raw source data imported into PostgreSQL successfully.
- FastAPI v1 read APIs implemented and smoke-tested.

## Completed
- API discovery (multi-round) completed for key modules.
- Migration export bundle completed.
- DB schema v1 added (`apps/api/schema/001_init.sql`).
- Import loader implemented and executed (`apps/api/scripts/load_raw_to_postgres.py`).
- Backend API design and frontend page plan docs completed.
- FastAPI endpoints implemented:
  - `/api/v1/health`
  - `/api/v1/dashboard/summary`
  - `/api/v1/students`
  - `/api/v1/students/{source_student_id}`
  - `/api/v1/teachers`
  - `/api/v1/orders`
  - `/api/v1/orders/{source_order_id}`
  - `/api/v1/hour-cost-flows`
  - `/api/v1/income-expense`
  - `/api/v1/rollcalls`

## Database Import Counts
- teachers: 8
- students: 327
- orders: 1629
- income_expense: 1512
- hour_cost_flows: 43736
- rollcalls: 465

## Next Actions
1. Add response DTO schemas and remove direct raw field exposure from API outputs.
2. Implement frontend MVP shell in Next.js and wire list pages to new APIs.
3. Build data integrity QA endpoint/report (null/duplicate/orphan checks).
4. Add integration tests for core list endpoints and query filters.
