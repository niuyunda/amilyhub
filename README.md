# AmilyHub Monorepo

## Local Run (API)
```bash
cd apps/api
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
uv run python main.py
```
- Swagger: `http://localhost:8000/docs`

## 技术栈

### 后端

- python + uv
- FastAPI
- SQLAlchemy

### 数据库

- PostgreSQL

### 前端

- Nextjs
- TypeScript
- TailwindCSS
- shadcn/ui
- pnpm