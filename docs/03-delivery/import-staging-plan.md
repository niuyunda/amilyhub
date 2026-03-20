# Import Staging Plan (Post-Export)

## Objective
Convert raw export artifacts into DB-import-ready normalized datasets for the new FastAPI + PostgreSQL system.

## Input Bundle
Root: `apps/api/exports/raw/export_20260320_130436/`

- teachers.jsonl (8)
- students_learning.jsonl (326)
- orders.jsonl (1629)
- income_expense.jsonl (1512)
- hour_cost_flows.jsonl (43736)
- rollcalls_export_student.xls (465 rows, 24 cols)
- export_summary.json

## Staging Output Target
`apps/api/exports/staging/20260320_v1/`

Planned files:
- dim_teachers.jsonl
- dim_students.jsonl
- fact_orders.jsonl
- fact_income_expense.jsonl
- fact_hour_cost_flows.jsonl
- fact_rollcalls.jsonl
- qa_report.json

## Execution Steps
1. Parse + normalize rollcalls XLS to JSONL.
2. Standardize primary identifiers (`source_*_id`) and timestamps.
3. Normalize money fields to minor units (`*_cents`) while preserving raw fields.
4. Build relation keys:
   - student_id / teacher_id / class_id / course_id / order_id
5. Generate QA report:
   - row counts
   - null rates for required fields
   - duplicate key checks
   - cross-table reference hit rate

## Acceptance Criteria
- All six staging files generated.
- QA report produced with pass/fail markers.
- No destructive changes to raw export files.
