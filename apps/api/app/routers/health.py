from fastapi import APIRouter

from ..core.runtime import bootstrap_ready
from ..core.config import settings
from ..db import fetch_one


router = APIRouter(tags=["health"])


@router.get("/api/v1/health")
def health() -> dict[str, object]:
    row = fetch_one("select now() as server_time")
    return {
        "ok": True,
        "server_time": row["server_time"] if row else None,
        "environment": settings.environment,
        "bootstrap_ready": bootstrap_ready(),
    }
