# Backend Implementation Status (P0)

## Completed (2026-03-20)

### 1) Students (闭环)
- `GET /api/v1/students` 列表 + 分页 + 关键词/状态筛选
- `GET /api/v1/students/{source_student_id}` 详情
- `POST /api/v1/students` 创建（基础字段）
- `PUT /api/v1/students/{source_student_id}` 更新（基础字段）

基础字段覆盖：
- `source_student_id`, `name`, `phone`, `gender`, `birthday`, `status`

### 2) Orders (闭环)
- `GET /api/v1/orders` 列表 + 分页 + 学员/状态筛选
- `GET /api/v1/orders/{source_order_id}` 详情
- `POST /api/v1/orders` 创建
- `PUT /api/v1/orders/{source_order_id}` 更新

校验：
- 创建/更新订单时，若传入 `source_student_id`，会校验学生存在性；不存在返回 `422 STUDENT_NOT_FOUND`。

### 3) Hour cost flows / rollcalls
- `GET /api/v1/hour-cost-flows`
  - 支持筛选：`student_id`, `teacher_id`, `cost_type`, `source_type`, `checked_from`, `checked_to`
  - 补全关键字段返回：`source_id/source_student_id/source_teacher_id/source_class_id/source_course_id/cost_type/source_type/cost_hours/cost_amount_cents/checked_at/source_created_at`
- `GET /api/v1/rollcalls`
  - 支持筛选：`q`, `student_name`, `teacher_name`, `status`
  - 返回核心点名字段

### 4) Income/expense
- `GET /api/v1/income-expense`
  - 支持筛选：`direction`, `item_type`, `operation_date_from`, `operation_date_to`
- `GET /api/v1/income-expense/summary`
  - 汇总输出：`total_count`, `income_cents`, `expense_cents`, `net_income_cents`

### 5) Dashboard summary
- `GET /api/v1/dashboard/summary` 增加常用统计字段：
  - `students`, `active_students`, `teachers`, `orders`
  - `hour_cost_flows`, `rollcalls`, `income_expense`
  - `income_cents`, `expense_cents`, `net_income_cents`
  - `receivable_cents`, `received_cents`, `arrears_cents`

### 6) 统一响应模型 / 错误码 / 分页
统一约定：
- 成功对象：`{ ok: true, data: {...} }`
- 成功列表：`{ ok: true, data: [...], page: { page, page_size, total } }`
- 错误：`{ ok: false, error: { code, message, details? } }`

已统一错误处理：
- 业务错误：`ApiError`（如 `STUDENT_NOT_FOUND`, `ORDER_NOT_FOUND`, `*_EXISTS`）
- 参数校验错误：`VALIDATION_ERROR`（422）

### 7) pytest 覆盖（核心接口）
- 已补充 11 个核心接口用例，覆盖：
  - health
  - dashboard summary 字段
  - students 列表分页
  - students 创建/更新/不存在错误
  - orders 创建（含学员关联校验）/更新
  - hour-cost-flows 列表
  - income-expense summary
  - rollcalls 列表
  - data integrity

## How to run
```bash
cd apps/api
uv run pytest -q
```

本地启动：
```bash
cd apps/api
uv run python main.py
```

OpenAPI: `http://localhost:8000/docs`
