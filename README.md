# AmilyHub Monorepo

Agent-built migration project to replace the current teaching SaaS in phases.

## Current Milestone
✅ API discovery complete  
✅ Raw data export complete  
✅ PostgreSQL containerized and imported  
✅ FastAPI read API bootstrap online

## Quick Links
- Agent entry: `AGENT_ENTRY.md`
- Docs index: `docs/README.md`
- Handover state: `docs/handover/current-status.md`
- Export milestone: `docs/03-delivery/export-milestone-2026-03-20.md`
- DB import result: `docs/03-delivery/db-import-result-2026-03-20.md`
- Backend implementation status: `docs/03-delivery/backend-implementation-status.md`

## Local PostgreSQL (Docker)
- Compose: `infra/docker-compose.dev.yml`
- Env template: `infra/.env.example`
- Detailed runbook: `docs/runbooks/postgres-docker-setup.md`

## API Dev
```bash
cd apps/api
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
uv run python main.py
```
Swagger:
- `http://localhost:8000/docs`

## Repo Notes
- `READ.md` keeps the original user requirement transcript.
- `README.md` is the current project operating summary.
