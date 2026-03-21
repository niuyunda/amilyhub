# AmilyHub Monorepo

我经营一家英语机构叫 Amily，目前正在使用小麦助教 b.xiaomai5.com 作为教务管理的第三方 SaaS系统。
amilyhub 这个项目是对小麦助教主要功能的复刻，目的是我想用自建SaaS，这样有什么需要我可以自己改。


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