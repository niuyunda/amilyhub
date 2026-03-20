# Field Mapping v1 (Source -> Target)

> This is the first-pass mapping for agent implementation. Keep raw fields for traceability.

## Common Conventions
- Keep original source IDs in `source_id` (string)
- Preserve source payload in `raw_json` when uncertain
- Timestamps normalized to ISO8601 UTC in `*_at`
- Money normalized to cents (`*_cents`) + original decimal retained

## teachers.jsonl -> dim_teachers
- teacherId/adminId -> source_id
- teacherName -> name
- phone -> phone
- gender -> gender
- lastMonthLessons -> last_month_lessons
- currentMonthLessons -> current_month_lessons
- totalFinishLessons -> total_finished_lessons

## students_learning.jsonl -> dim_students
- studentId/id -> source_id
- name/studentName -> name
- phone/mobile -> phone
- gender -> gender
- birthday -> birthday
- creator/admin info -> created_by

## orders.jsonl -> fact_orders
- voucherId/businessId/id -> source_order_id
- studentId -> source_student_id
- businessType/orderType -> order_type
- state/businessState -> order_state
- shouldFee/realFee/arrearsFee -> receivable_cents/received_cents/arrears_cents
- created/createdTime -> created_at

## income_expense.jsonl -> fact_income_expense
- id -> source_id
- bizType/itemName -> item_type
- direction/type -> direction
- amount -> amount_cents
- operationDate -> operation_date
- related order field -> source_order_id

## hour_cost_flows.jsonl -> fact_hour_cost_flows
- id -> source_id
- studentId -> source_student_id
- classId/courseId/teacherId -> source_class_id/source_course_id/source_teacher_id
- costType/sourceType -> cost_type/source_type
- costHour -> cost_hours
- costAmount -> cost_amount_cents
- checkedDate/createTime -> checked_at/created_at

## rollcalls_export_student.xls -> fact_rollcalls
- Parse sheet headers from `rollcalls_export_student.schema.json`
- Map core fields:
  - 学员 -> student_name/source_student_id (if present)
  - 班级 -> class_name/source_class_id (if present)
  - 老师 -> teacher_name/source_teacher_id (if present)
  - 点名时间/上课时间 -> rollcall_at/class_time_range
  - 状态 -> rollcall_state
  - 课消金额 -> cost_amount_cents
- Preserve full row in `raw_json` for v1
