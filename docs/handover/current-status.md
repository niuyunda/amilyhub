# Current Status

## Latest
- 数据导出：已完成（核心数据齐全）
- PostgreSQL：已通过 Docker Compose 启动并完成导入
- FastAPI：已完成 v1 读取接口并通过本地 smoke test

## Imported Data Counts
- teachers: 8
- students: 327
- orders: 1629
- income_expense: 1512
- hour_cost_flows: 43736
- rollcalls: 465

## API Implemented
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

## What Is Stable Now
- 数据层和读取接口可用，可供前端MVP直接接入。

## What Is Next
见：`handover/todo.md`
