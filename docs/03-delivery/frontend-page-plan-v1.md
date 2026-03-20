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
