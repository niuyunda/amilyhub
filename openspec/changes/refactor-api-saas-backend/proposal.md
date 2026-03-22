## Why

`apps/api` currently exposes the backend through a single large FastAPI module at `apps/api/app/api.py` that mixes route registration, Pydantic schemas, validation, RBAC, audit logging, SQL text, pagination helpers, and domain workflows in one file. That structure is workable for quick iteration, but it is brittle for a coding-agent-only project because there is no clear module ownership, no obvious extension boundary, and too much coupling between transport, business logic, and persistence concerns.

The backend also carries several SaaS baseline gaps: permissive CORS defaults, settings with a committed local database URL fallback, on-demand table creation inside request paths, direct database access from route handlers, and tests that implicitly rely on the current monolith. A focused refactor is needed so future backend changes follow FastAPI best practice and are safer for coding agents to implement incrementally.

## What Changes

- Refactor `apps/api` into a clearer FastAPI backend structure with separated routers, schemas, services, repositories, and infrastructure modules.
- Break `apps/api/app/api.py` apart so the application entrypoint only owns app assembly, middleware, exception registration, and router inclusion.
- Introduce explicit backend boundaries for settings, database/session lifecycle, RBAC/auth context, audit logging, and shared error handling.
- Replace request-path table bootstrap logic with startup-safe initialization and migration-oriented patterns appropriate for a SaaS backend.
- Define coding-agent-friendly conventions for where new endpoints, business rules, queries, and tests belong in the Python + uv + FastAPI stack.

## Capabilities

### New Capabilities

- `saas-api-foundation`: A modular FastAPI application structure with clear assembly, lifecycle, configuration, and infrastructure boundaries.
- `agent-friendly-backend-modules`: Deterministic backend module ownership for routers, schemas, services, repositories, and shared dependencies.
- `operator-backend-governance`: Standardized RBAC, audit logging, error responses, and configuration handling suitable for an internal SaaS operator backend.

### Modified Capabilities

- Existing operator API endpoints under `/api/v1/*` will be preserved but moved behind clearer modules and shared backend contracts.

## Impact

- Affected code: `apps/api/app/api.py`, `apps/api/app/db.py`, `apps/api/app/config.py`, `apps/api/main.py`, backend tests, and likely new packages under `apps/api/app/`.
- Dependencies/systems: FastAPI application wiring, psycopg/SQLAlchemy usage patterns, uv-based local workflows, PostgreSQL schema management, and API test structure.
- Delivery impact: the refactor should preserve current endpoint behavior and URLs while improving backend maintainability, operability, and agent safety for future changes.
