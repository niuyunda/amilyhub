from fastapi import APIRouter, Depends, Query, status

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.schedule_events import ScheduleEventCreateRequest
from ..services.schedule_events import (
    create_schedule_event,
    delete_schedule_event,
    list_schedule_events,
    update_schedule_event,
)


router = APIRouter(tags=["schedule-events"])


@router.get("/api/v1/schedule-events", response_model=ListResponse)
def get_schedule_events(
    q: str | None = Query(default=None),
    date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=200),
) -> dict[str, object]:
    return list_schedule_events(q=q, date=date, page=page, page_size=page_size)


@router.post("/api/v1/schedule-events", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_schedule_event(
    payload: ScheduleEventCreateRequest,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return create_schedule_event(payload=payload.model_dump(mode="json"), ctx=ctx)


@router.put("/api/v1/schedule-events/{event_id}", response_model=ObjectResponse)
def put_schedule_event(
    event_id: int,
    payload: ScheduleEventCreateRequest,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return update_schedule_event(event_id=event_id, payload=payload.model_dump(mode="json"), ctx=ctx)


@router.delete("/api/v1/schedule-events/{event_id}", response_model=ObjectResponse)
def remove_schedule_event(
    event_id: int,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return delete_schedule_event(event_id=event_id, ctx=ctx)
