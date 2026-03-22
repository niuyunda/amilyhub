from fastapi import APIRouter, Query

from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.rollcalls import RollcallConfirmRequest
from ..services.rollcalls import confirm_rollcall, get_rollcall_detail, list_rollcalls


router = APIRouter(tags=["rollcalls"])


@router.get("/api/v1/rollcalls", response_model=ListResponse)
def get_rollcalls(q: str | None = Query(default=None), student_name: str | None = Query(default=None), teacher_name: str | None = Query(default=None), status_filter: str | None = Query(default=None, alias="status"), class_name: str | None = Query(default=None), date: str | None = Query(default=None), rollcall_date_start: str | None = Query(default=None), rollcall_date_end: str | None = Query(default=None), class_date_start: str | None = Query(default=None), class_date_end: str | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200)) -> dict[str, object]:
    return list_rollcalls(q=q, student_name=student_name, teacher_name=teacher_name, status=status_filter, class_name=class_name, date=date, rollcall_date_start=rollcall_date_start, rollcall_date_end=rollcall_date_end, class_date_start=class_date_start, class_date_end=class_date_end, page=page, page_size=page_size)


@router.get("/api/v1/rollcalls/{source_id}", response_model=ObjectResponse)
def get_rollcall(source_id: str) -> dict[str, object]:
    return get_rollcall_detail(source_id)


@router.post("/api/v1/rollcalls/{source_id}/confirm", response_model=ObjectResponse)
def post_rollcall_confirm(source_id: str, payload: RollcallConfirmRequest) -> dict[str, object]:
    return confirm_rollcall(source_id, payload.model_dump(mode="json"))
