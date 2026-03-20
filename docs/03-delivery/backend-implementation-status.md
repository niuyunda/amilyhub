# Backend Implementation Status (v1 bootstrap)

## Completed
- FastAPI skeleton implemented in `apps/api/app/api.py`
- Database config + connection helpers:
  - `apps/api/app/config.py`
  - `apps/api/app/db.py`
- Entrypoint updated: `apps/api/main.py`

## Implemented Endpoints
- `GET /api/v1/health`
- `GET /api/v1/students`
- `GET /api/v1/orders`
- `GET /api/v1/orders/{source_order_id}`
- `GET /api/v1/hour-cost-flows`

## Smoke Test Result
All key endpoints return HTTP 200 against imported local PostgreSQL dataset.

Observed totals:
- students: 327
- orders: 1629
- hour_cost_flows: 43736

## How to Run Locally
```bash
cd apps/api
export DATABASE_URL='postgresql://amily:alpha128128@localhost:55432/amilyhub'
uv run python main.py
```

Then open:
- `http://localhost:8000/docs`
