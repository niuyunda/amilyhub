from fastapi import APIRouter

from ..schemas.dashboard import DashboardSummaryResponse
from ..services.dashboard import get_dashboard_summary


router = APIRouter(tags=["dashboard"])


@router.get("/api/v1/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary() -> dict[str, object]:
    return get_dashboard_summary()
