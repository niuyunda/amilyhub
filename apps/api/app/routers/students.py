from fastapi import APIRouter, Query, status

from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.students import EnrollmentRequest, StudentUpdateRequest, StudentUpsertRequest
from ..services.students import create_student, delete_student, enroll_student, get_student, get_student_profile, list_students, update_student


router = APIRouter(tags=["students"])


@router.get("/api/v1/students", response_model=ListResponse)
def get_students(q: str | None = Query(default=None), status_filter: str | None = Query(default=None, alias="status"), source: str | None = Query(default=None), age_range: str | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=200)) -> dict[str, object]:
    return list_students(q=q, status=status_filter, source=source, age_range=age_range, page=page, page_size=page_size)


@router.get("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def get_student_by_id(source_student_id: str) -> dict[str, object]:
    return get_student(source_student_id)


@router.get("/api/v1/students/{source_student_id}/profile", response_model=ObjectResponse)
def get_student_profile_by_id(source_student_id: str) -> dict[str, object]:
    return get_student_profile(source_student_id)


@router.post("/api/v1/students", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_student(payload: StudentUpsertRequest) -> dict[str, object]:
    return create_student(payload.model_dump(mode="json"))


@router.put("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def put_student(source_student_id: str, payload: StudentUpdateRequest) -> dict[str, object]:
    return update_student(source_student_id, payload.model_dump(mode="json", exclude_none=True))


@router.delete("/api/v1/students/{source_student_id}", response_model=ObjectResponse)
def remove_student(source_student_id: str, cascade: bool = Query(default=False)) -> dict[str, object]:
    return delete_student(source_student_id, cascade)


@router.post("/api/v1/students/{source_student_id}/enroll", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_student_enrollment(source_student_id: str, payload: EnrollmentRequest) -> dict[str, object]:
    return enroll_student(source_student_id, payload.model_dump(mode="json"))
