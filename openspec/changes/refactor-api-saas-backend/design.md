## Context

`apps/api` is a Python + uv + FastAPI service intended for coding-agent-driven development. The current backend has only a few small support modules (`config.py`, `db.py`) and concentrates almost all behavior in `apps/api/app/api.py`. That file currently contains:

- app creation and middleware registration
- error types and handlers
- RBAC cache and permission management
- audit log bootstrap and writes
- request/response schemas
- normalization helpers and ID generation
- direct SQL queries and mutations
- more than 30 route handlers across students, teachers, orders, schedules, finance, classes, and integrity checks

This design makes each change high-risk because route logic, storage details, and cross-cutting concerns are interleaved. The target state is a modular SaaS backend where transport, domain logic, and persistence can evolve independently while preserving the current API surface.

## Goals / Non-Goals

**Goals:**

- Reduce `apps/api/app/api.py` to a thin composition layer.
- Establish one canonical place for routers, request/response schemas, services, repositories, and shared dependencies.
- Standardize configuration, DB lifecycle, RBAC, audit logging, and error handling in reusable infrastructure modules.
- Preserve existing `/api/v1` behavior as much as possible during the refactor.
- Make future coding-agent work predictable by using explicit module conventions and narrow file responsibilities.

**Non-Goals:**

- Rebuild the domain model or redesign business rules for students, finance, classes, or scheduling.
- Introduce a full external auth provider, multi-tenant billing stack, or background job platform in this refactor.
- Replace PostgreSQL or the Python + uv + FastAPI stack.
- Deliver a complete ORM migration if the current SQL-first approach can be improved safely through better repository boundaries first.

## Decisions

### 1. Keep a thin FastAPI application assembly layer

`apps/api/app/api.py` should become an application factory or assembly module that creates the FastAPI app, applies middleware, registers exception handlers, wires startup lifecycle hooks, and includes routers. Domain endpoints should move out of the entry module.

Rationale:
- This follows standard FastAPI structure and lowers merge conflict pressure in one oversized file.
- It gives coding agents a single stable rule: new endpoint behavior belongs in a feature router/service, not in app assembly.
- It makes testing and future startup/lifecycle changes easier.

Alternatives considered:
- Keep the monolithic module and only add comments. Rejected because ownership stays ambiguous.
- Split only schemas from routes. Rejected because SQL and business logic would still be coupled to transport.

### 2. Use feature-oriented routers with shared dependencies

Endpoints should be grouped into feature routers such as `students`, `teachers`, `orders`, `finance`, `scheduling`, `rbac`, and `audit`. Shared dependencies should provide operator context, permission checks, pagination parsing, and common response shapes.

Rationale:
- The existing endpoint surface already clusters naturally by domain.
- Feature routers give coding agents one obvious place to make endpoint-level changes.
- Shared dependencies reduce repetitive request parsing and authorization logic.

Alternatives considered:
- Split files purely by HTTP verb or object type. Rejected because domain workflows span multiple operations.
- Keep everything in one `routers/api_v1.py`. Rejected because it recreates the current scaling problem.

### 3. Introduce service and repository boundaries before deeper data-layer changes

Business workflows should move into services, and SQL access should move into repository modules. The initial refactor can keep SQL-first persistence with psycopg where that is already established, but route handlers should stop issuing ad hoc SQL directly. If SQLAlchemy is retained, it should be introduced deliberately at the infrastructure boundary rather than mixed into request handlers.

Rationale:
- This is the lowest-risk path to separate concerns without forcing a full persistence rewrite.
- It supports incremental migration from raw SQL to more structured data access where justified.
- It improves unit-testability and isolates transaction handling.

Alternatives considered:
- Rewrite everything to SQLAlchemy ORM immediately. Rejected because it adds scope and migration risk across a large API surface.
- Keep direct SQL in route handlers. Rejected because it preserves the current coupling.

### 4. Move startup bootstrap and schema safety out of request paths

Helpers such as table creation for RBAC, audit logs, rooms, courses, and schedules should no longer run lazily during normal requests. Initialization should move to controlled startup or migration paths, with runtime code assuming required schema is present.

Rationale:
- Request-time DDL is an operational risk and complicates error handling.
- SaaS backend best practice favors predictable schema management and explicit startup checks.
- This improves performance and removes hidden side effects from reads and writes.

Alternatives considered:
- Keep lazy table creation for convenience. Rejected because it hides deployment drift and creates inconsistent runtime behavior.

### 5. Harden configuration and governance defaults

Settings should move toward explicit environment-driven configuration, including database URL handling, allowed CORS origins, environment mode, and operator/auth defaults. RBAC and audit logging should become infrastructure services with clear interfaces and tests rather than globally mutable logic in the main API file.

Rationale:
- The current committed local `database_url` default and wildcard CORS are not sound SaaS defaults.
- Governance concerns should be reusable across routers and service layers.
- This gives coding agents a predictable place to extend operational policy.

Alternatives considered:
- Preserve current defaults for speed. Rejected because the refactor is specifically meant to raise backend baseline quality.

## Risks / Trade-offs

- [Behavior drift while splitting the monolith] -> Mitigate by preserving route paths, response envelopes, and existing integration tests while migrating domain slices incrementally.
- [Repository/service layering adds files and concepts] -> Mitigate by keeping the initial module contract small and naming consistent.
- [Startup checks may expose schema gaps hidden by lazy DDL] -> Mitigate by documenting required migrations and adding explicit startup diagnostics.
- [Changing config defaults can affect local development] -> Mitigate by keeping uv-friendly `.env` support and documenting a simple local setup path.
- [RBAC and audit extraction can surface implicit coupling] -> Mitigate by migrating those concerns first and reusing shared dependency helpers across domains.

## Migration Plan

1. Define the target package layout and move app assembly, settings, DB lifecycle, and shared exceptions into dedicated modules.
2. Extract cross-cutting concerns first: operator context, permission dependencies, audit logging, pagination helpers, and common response models.
3. Migrate one representative vertical slice at a time from `api.py` into router, schema, service, and repository modules while keeping `/api/v1` routes stable.
4. Replace request-time schema bootstrap with startup validation and explicit migration guidance.
5. Reorganize tests to validate app assembly, shared dependencies, and representative domain routes against the new module structure.

Rollback strategy:
- Keep refactoring incremental and route-compatible so individual domain slices can remain on the old implementation temporarily if a migration causes regressions.
- Avoid deleting legacy helpers until replacement modules are verified by tests.

## Open Questions

- Should the backend standardize on psycopg repositories first, or is there a strong requirement to move to SQLAlchemy session management during this refactor?
- Which domain slice should be migrated first as the reference implementation: students/orders, scheduling, or finance?
- Is this backend expected to remain single-tenant internal SaaS for the near term, or should tenant/account boundaries influence the module design now?
