# Docs (Refactored)

只保留当前可执行信息：**最新状态 + 待办 + 当前实现说明**。

## 先读（新 agent 入口）
1. `handover/current-status.md`  ← 当前真实状态
2. `handover/todo.md`            ← 下一步待办清单
3. `03-delivery/backend-implementation-status.md` ← 后端当前实现
4. `runbooks/postgres-docker-setup.md` ← 本地数据库运行方式

## 核心文档
- 项目约束：`00-governance/project-charter.md`
- 数据库设计：`01-architecture/db-schema-v1.md`
- 后端 API 设计：`03-delivery/backend-api-design-v1.md`
- 前端页面规划：`03-delivery/frontend-page-plan-v1.md`
- 导入结果：`03-delivery/db-import-result-2026-03-20.md`
- 操作日志：`04-operations/work-log.md`

## 维护规则
- 任何阶段变化，先更新：
  - `handover/current-status.md`
  - `handover/todo.md`
- 过时文档直接删除，不保留“旧计划占位文档”。
