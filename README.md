# AmilyHub Monorepo

当前项目状态与待办统一入口：
- `entry.md`

## Quick Start for Agents
1. 读 `entry.md`
2. 读 `docs/handover/current-status.md`
3. 读 `docs/handover/todo.md`

## Current Snapshot
- 核心数据导出与入库完成
- FastAPI v1 读取接口可用
- 正在进入前端 MVP 与 API DTO 标准化阶段

## Local Run (API)
```bash
cd apps/api
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
uv run python main.py
```
- Swagger: `http://localhost:8000/docs`

## Notes
- `READ.md` 是原始需求记录
- `README.md + entry.md + docs/handover/*` 是当前执行入口
