# Agent Entry (Start Here)

This is the routing doc for any new agent session.

## 1) Read in this exact order
1. `README.md`
2. `docs/handover/current-status.md`
3. `docs/03-delivery/export-milestone-2026-03-20.md`
4. `docs/03-delivery/db-import-result-2026-03-20.md`
5. `docs/03-delivery/backend-implementation-status.md`
6. `docs/04-operations/work-log.md`

## 2) Project snapshot
- Project: `amilyhub` (monorepo)
- Objective: replace source SaaS in phases, then evolve to agent-native operations
- Source SaaS: Xiaomai teaching-management platform (read-only reverse engineering)
- Current stage: **Data export + DB import completed, backend read API bootstrap completed**

## 3) Ground rules
- Keep all artifacts in this repo.
- All decisions/operations must be recorded in `/docs`.
- Update `docs/handover/current-status.md` before ending interrupted work.
- Secrets go in local `.env` files only (never commit).

## 4) Current technical baseline
- Local PostgreSQL via Docker Compose (`infra/docker-compose.dev.yml` + `infra/.env`)
- Imported schema: `apps/api/schema/001_init.sql`
- Imported data available in schema `amilyhub`
- API bootstrap in `apps/api/app/api.py`

## 5) Immediate next pointer
Follow `docs/handover/current-status.md` → **Next Actions**.
