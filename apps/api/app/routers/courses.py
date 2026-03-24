from fastapi import APIRouter, Query

from ..schemas.common import ListResponse, ObjectResponse
from ..services.courses import create_course, delete_course, list_courses, update_course


router = APIRouter(tags=["courses"])


@router.get("/api/v1/courses", response_model=ListResponse)
def get_courses(
    q: str | None = Query(default=None),
    course_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, object]:
    return list_courses(q=q, course_type=course_type, status=status, page=page, page_size=page_size)


@router.post("/api/v1/courses", response_model=ObjectResponse, status_code=201)
def post_course(payload: dict) -> dict[str, object]:
    return create_course(payload=payload)


@router.put("/api/v1/courses/{course_id}", response_model=ObjectResponse)
def put_course(course_id: str, payload: dict) -> dict[str, object]:
    return update_course(course_id=course_id, payload=payload)


@router.delete("/api/v1/courses/{course_id}", response_model=ObjectResponse)
def delete_course_by_id(course_id: str) -> dict[str, object]:
    return delete_course(course_id=course_id)
