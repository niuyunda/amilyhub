# Frontend Page Plan v1 (Next.js + shadcn)

## IA (Information Architecture)
1. Dashboard
2. 学员管理 (Students)
3. 老师管理 (Teachers)
4. 订单管理 (Orders)
5. 上课记录 (Rollcalls)
6. 课消流水 (Hour Cost Flows)
7. 收支明细 (Income/Expense)
8. 数据校验 (Import QA / Integrity)

## Pages
### 1) Dashboard
- KPI cards: students, active teachers, monthly orders, monthly income, monthly cost flow
- trend charts

### 2) Students
- list + filters + pagination
- detail drawer: profile + orders + hour consumption

### 3) Teachers
- list + load stats
- detail page: classes + rollcalls

### 4) Orders
- list + multi-filter + status badges
- detail page
- summary panel (receivable/received/arrears)

### 5) Rollcalls
- table from rollcalls import
- filters by date/class/teacher/student

### 6) Hour Cost Flows
- high-volume table with server-side pagination
- summary by class/teacher/student

### 7) Income/Expense
- ledger table + monthly summary

### 8) Data QA
- import run history
- row-count comparison vs raw source summary
- anomaly list (null/duplicate/orphan refs)

## Component plan (shadcn)
- DataTable + server pagination
- FilterBar
- SummaryCard
- DetailSheet/Drawer
- ChartCard (line/bar)
- StatusBadge

---

## 实际完成情况（P0, React + Vite）

完成日期：2026-03-20

### 已完成页面/流程
1. Dashboard
- ✅ 核心统计卡片（students/teachers/orders/hour_cost_flows/income/expense）
- ✅ 简单分组展示：订单状态分布（表格）
- ✅ 数据完整性问题展示（integrity issues 表格）

2. Students
- ✅ 列表 + 分页
- ✅ 搜索（q）
- ✅ 状态筛选（status）
- ✅ 详情侧边抽屉（点击行触发 `GET /api/v1/students/{source_student_id}`）

3. Orders
- ✅ 列表 + 分页
- ✅ 状态筛选（state）
- ✅ 学员筛选（student_id）
- ✅ 详情侧边抽屉（点击行触发 `GET /api/v1/orders/{source_order_id}`）

4. Hour Cost Flows
- ✅ 列表 + 分页
- ✅ 学员/老师筛选（student_id, teacher_id）

5. Rollcalls
- ✅ 列表 + 分页
- ✅ 搜索（q）

6. Income/Expense
- ✅ 列表 + 分页
- ✅ 方向筛选（direction）

### 参数与状态统一
- ✅ 前后端参数对齐：
  - students: `q`, `status`, `page`, `page_size`
  - orders: `student_id`, `state`, `page`, `page_size`
  - hour-cost-flows: `student_id`, `teacher_id`, `page`, `page_size`
  - rollcalls: `q`, `page`, `page_size`
  - income-expense: `direction`, `page`, `page_size`
- ✅ 统一 loading 提示（列表、Dashboard、详情）
- ✅ 统一错误提示（API 错误解析：detail/message/error）

### 说明
- 本阶段目标是“功能等价、可用优先”，未做像素级还原。
- Dashboard 趋势图暂用表格分组展示替代（符合 P0 要求）。
