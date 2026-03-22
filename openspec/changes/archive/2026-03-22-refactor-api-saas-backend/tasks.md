## 1. Backend Architecture Foundation

- [x] 1.1 Audit the current `apps/api` package, endpoint surface, shared helpers, and database access patterns, then define the canonical target module layout for app assembly, routers, schemas, services, repositories, and infrastructure.
- [x] 1.2 Reduce `apps/api/app/api.py` to a thin composition layer that creates the FastAPI app, registers middleware and exception handlers, and includes feature routers.
- [x] 1.3 Introduce a stable package structure under `apps/api/app/` for `core`, `dependencies`, `routers`, `schemas`, `services`, and `repositories` or equivalent explicit backend boundaries.

## 2. Infrastructure and Governance Extraction

- [x] 2.1 Refactor settings and environment loading so database, CORS, and runtime options come from explicit configuration with uv-friendly local defaults.
- [x] 2.2 Replace raw global RBAC and operator-context logic with reusable dependencies/services that routers can consume consistently.
- [x] 2.3 Extract audit logging, shared error models, exception handlers, and pagination/query helpers into reusable infrastructure modules with tests.

## 3. Domain Slice Migration

- [x] 3.1 Migrate a representative CRUD slice from `api.py` into router, schema, service, and repository modules while preserving current `/api/v1` contracts.
- [x] 3.2 Migrate the remaining student, teacher, order, finance, class, scheduling, and integrity endpoints in incremental slices, removing direct SQL and business logic from route handlers.
- [x] 3.3 Consolidate duplicated normalization, ID generation, and validation helpers behind shared domain or infrastructure utilities.

## 4. Data Lifecycle and Operational Hardening

- [x] 4.1 Remove request-time table/bootstrap DDL from normal endpoint execution and replace it with startup validation and migration-oriented workflows.
- [x] 4.2 Standardize transaction and connection handling at the repository/service boundary so request handlers no longer manage persistence details directly.
- [x] 4.3 Tighten SaaS backend defaults for CORS, configuration validation, and operational diagnostics appropriate for an internal operator service.

## 5. Verification and Contributor Guidance

- [x] 5.1 Reorganize backend tests so they validate application assembly, shared dependencies, and representative domain behavior against the modular structure.
- [x] 5.2 Add or update regression checks for RBAC, audit logging, error envelopes, and the highest-value domain endpoints after the refactor.
- [x] 5.3 Document coding-agent-friendly backend conventions for where to add routers, schemas, services, repositories, and cross-cutting infrastructure in `apps/api`.
