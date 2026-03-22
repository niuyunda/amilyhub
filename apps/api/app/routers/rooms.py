from fastapi import APIRouter, Depends, Query, status

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.rooms import RoomCreateRequest, RoomUpdateRequest
from ..services.rooms import create_room, delete_room, list_rooms, update_room


router = APIRouter(tags=["rooms"])


@router.get("/api/v1/rooms", response_model=ListResponse)
def get_rooms(
    q: str | None = Query(default=None),
    campus: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, object]:
    return list_rooms(q=q, campus=campus, status=status_filter, page=page, page_size=page_size)


@router.post("/api/v1/rooms", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_room(
    payload: RoomCreateRequest,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return create_room(payload=payload.model_dump(mode="json"), ctx=ctx)


@router.put("/api/v1/rooms/{room_id}", response_model=ObjectResponse)
def put_room(
    room_id: int,
    payload: RoomUpdateRequest,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return update_room(room_id=room_id, payload=payload.model_dump(mode="json", exclude_none=True), ctx=ctx)


@router.delete("/api/v1/rooms/{room_id}", response_model=ObjectResponse)
def remove_room(
    room_id: int,
    ctx: OperatorContext = Depends(require_permission("schedule:write")),
) -> dict[str, object]:
    return delete_room(room_id=room_id, ctx=ctx)
