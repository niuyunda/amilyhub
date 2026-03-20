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

### 本地运行方式
```bash
# API（示例）
cd apps/api
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
uv run python main.py

# Web
cd apps/web
npm install
npm run dev
# 或构建
npm run build
```

### 简单自测清单
- [ ] Dashboard 可加载 KPI 卡片，且出现订单状态分布与 integrity 表格
- [ ] Students 支持 q/status 过滤；点击行可打开详情侧栏
- [ ] Orders 支持 state/student_id 过滤；点击行可打开详情侧栏
- [ ] Hour Cost Flows 支持 student_id/teacher_id 过滤
- [ ] Rollcalls 支持 q 搜索
- [ ] Income/Expense 支持 direction 过滤
- [ ] 各页面加载时显示 Loading，接口异常时显示统一错误信息
- [ ] 分页 Prev/Next 行为正确，Total 与页码显示正确

---

## SaaS redesign（2026-03-20）

在不改变后端 API 契约和数据交互逻辑的前提下，完成了前端页面的信息架构与 UX/UI 重构，目标为「标准 SaaS 产品体验」。

### 1) 全局布局（桌面优先，响应式）
- 新增统一三段式布局：左侧导航 + 顶部栏 + 主内容区。
- 顶部栏支持当前页面标题/说明与刷新操作。
- 中小屏降级为顶部横向导航，内容区与详情面板自动转单列。

### 2) 设计系统基础（浅色主题）
- 建立全局 design tokens：颜色、边框、阴影、圆角、间距、字体层级。
- 统一基础组件样式：按钮、输入框、表格、卡片、状态容器。
- 预留主题变量结构（`--*` 变量），后续可扩展 dark mode。

### 3) 页面体验优化
- Dashboard：
  - KPI 卡片重做（视觉层级更清晰，数字更突出）。
  - 区块化展示“订单状态分布 / 数据完整性”。
- Students / Orders / Flows / Rollcalls / IncomeExpense：
  - 统一 FilterBar（筛选输入 + Reset）。
  - 统一 DataTable 容器（表头、滚动、行 hover、点击态）。
  - 统一分页区（页码/总数 + Prev/Next 行为）。
  - 统一空态、加载态、错误态（含 Retry）。
- 详情面板：
  - 标题区和关闭行为清晰。
  - 详情按字段分组展示（基础字段 + 嵌套对象分区），可读性更好。

### 4) 可用性改进
- 通过固定容器最小高度与状态组件，减少加载/空数据时页面跳动。
- 按钮状态明确（禁用态、刷新进行中）。
- 错误提示统一且更友好（列表、Dashboard、详情均一致）。

### 5) 接口兼容性
- 保持原有接口与参数映射不变：
  - students: `q`, `status`, `page`, `page_size`
  - orders: `student_id`, `state`, `page`, `page_size`
  - hour-cost-flows: `student_id`, `teacher_id`, `page`, `page_size`
  - rollcalls: `q`, `page`, `page_size`
  - income-expense: `direction`, `page`, `page_size`
- 保留原有详情接口：`GET /students/{source_student_id}`、`GET /orders/{source_order_id}`。
