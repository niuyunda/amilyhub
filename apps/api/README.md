# `apps/api`

FastAPI backend for AmilyHub. This service now uses a modular app layout so coding-agent changes can stay localized instead of editing one large route file.

## Local Run

```bash
uv run python main.py
```

The server host, port, database URL, and CORS origins come from `app/core/config.py` via environment variables or `.env`.

## Backend Layout

- `app/api.py`: thin app entrypoint.
- `app/core/`: application assembly, config, and shared error handling.
- `app/dependencies/`: request-scoped dependencies such as operator context and permission checks.
- `app/routers/`: HTTP route modules. Put transport concerns here only.
- `app/schemas/`: request and response models.
- `app/services/`: business logic and cross-cutting orchestration.
- `app/repositories/`: database access and SQL.
- `app/utils/`: small shared helpers.
- `app/legacy_api.py`: untouched legacy routes kept temporarily during incremental migration.

## Working Rules

- Add new endpoints in a router module, not in `app/api.py`.
- Keep validation and HTTP concerns in routers/schemas; move business rules into services.
- Keep SQL in repositories. Route handlers should not execute ad hoc SQL directly.
- If a legacy route needs changes, prefer extracting that slice into router/service/repository modules instead of growing `legacy_api.py`.
- Preserve `/api/v1` contracts during migration unless the OpenSpec change explicitly changes them.

## Tests

```bash
uv run pytest tests/test_api.py tests/test_app_structure.py
```

`test_app_structure.py` verifies the composed app wiring, while `test_api.py` covers end-to-end API behavior against the configured database.
