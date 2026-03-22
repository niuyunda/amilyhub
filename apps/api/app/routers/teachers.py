from fastapi import APIRouter, Depends, Query, status

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.teachers import TeacherCreateRequest, TeacherStatusUpdateRequest, TeacherUpdateRequest
from ..services.teachers import create_teacher, list_teachers, update_teacher, update_teacher_status


router = APIRouter(tags=["teachers"])


@router.get("/api/v1/teachers", response_model=ListResponse)
def get_teachers(
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
) -> dict[str, object]:
    return list_teachers(q=q, status=status_filter, page=page, page_size=page_size)


@router.post("/api/v1/teachers", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_teacher(
    payload: TeacherCreateRequest,
    ctx: OperatorContext = Depends(require_permission("teachers:write")),
) -> dict[str, object]:
    return create_teacher(payload=payload.model_dump(mode="json"), ctx=ctx)


@router.put("/api/v1/teachers/{source_teacher_id}", response_model=ObjectResponse)
def put_teacher(
    source_teacher_id: str,
    payload: TeacherUpdateRequest,
    ctx: OperatorContext = Depends(require_permission("teachers:write")),
) -> dict[str, object]:
    return update_teacher(
        source_teacher_id=source_teacher_id,
        payload=payload.model_dump(mode="json", exclude_none=True),
        ctx=ctx,
    )


@router.patch("/api/v1/teachers/{source_teacher_id}/status", response_model=ObjectResponse)
def patch_teacher_status(
    source_teacher_id: str,
    payload: TeacherStatusUpdateRequest,
    ctx: OperatorContext = Depends(require_permission("teachers:write")),
) -> dict[str, object]:
    return update_teacher_status(source_teacher_id=source_teacher_id, status=payload.status, ctx=ctx)
