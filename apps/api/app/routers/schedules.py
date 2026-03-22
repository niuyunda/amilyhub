from fastapi import APIRouter, Query

from ..schemas.common import ListResponse
from ..services.schedules import list_schedules


router = APIRouter(tags=["schedules"])


@router.get("/api/v1/schedules", response_model=ListResponse)
def get_schedules(view: str | None = Query(default="time"), q: str | None = Query(default=None), date: str | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=200, ge=1, le=200)) -> dict[str, object]:
    del view
    return list_schedules(q=q, date=date, page=page, page_size=page_size)
