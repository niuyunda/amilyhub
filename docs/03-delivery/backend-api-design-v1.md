# Backend API Design v1 (FastAPI)

Base path: `/api/v1`

## 1) Students
- `GET /students`
  - filters: `q`, `phone`, `status`, `page`, `page_size`
- `GET /students/{id}`
- `GET /students/{id}/orders`
- `GET /students/{id}/hour-cost-flows`

## 2) Teachers
- `GET /teachers`
- `GET /teachers/{id}`
- `GET /teachers/{id}/rollcalls`

## 3) Orders
- `GET /orders`
  - filters: `student_id`, `state`, `type`, `date_from`, `date_to`
- `GET /orders/{id}`
- `GET /orders/summary`

## 4) Finance
- `GET /finance/income-expense`
- `GET /finance/income-expense/summary`

## 5) Teaching Records
- `GET /rollcalls`
  - filters: `student_name`, `teacher_name`, `class_name`, `date_from`, `date_to`
- `GET /hour-cost-flows`
  - filters: `student_id`, `teacher_id`, `class_id`, `date_from`, `date_to`
- `GET /hour-cost-flows/summary`

## 6) Admin / Migration
- `POST /admin/import/run` (internal use)
- `GET /admin/import/runs`
- `GET /admin/health/data-integrity`

Notes:
- First release is read-heavy to match migration phase.
- Write APIs (create/update/void) can be enabled after operator validation.
