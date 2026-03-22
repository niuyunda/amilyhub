from fastapi import APIRouter, Query, status

from ..schemas.classes import ClassCreateRequest, ClassStudentAddRequest, ClassUpdateRequest
from ..schemas.common import ListResponse, ObjectResponse
from ..services.classes import add_student_to_class, create_class, delete_class, get_class_profile, list_classes, remove_student_from_class, update_class


router = APIRouter(tags=["classes"])


@router.get("/api/v1/classes", response_model=ListResponse)
def get_classes(q: str | None = Query(default=None), teacher_name: str | None = Query(default=None), status_filter: str | None = Query(default=None, alias="status"), class_type: str | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=200)) -> dict[str, object]:
    return list_classes(q=q, teacher_name=teacher_name, status=status_filter, class_type=class_type, page=page, page_size=page_size)


@router.post("/api/v1/classes", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_class(payload: ClassCreateRequest) -> dict[str, object]:
    return create_class(payload.model_dump(mode="json"))


@router.put("/api/v1/classes/{class_id}", response_model=ObjectResponse)
def put_class(class_id: int, payload: ClassUpdateRequest) -> dict[str, object]:
    return update_class(class_id, payload.model_dump(mode="json", exclude_none=True))


@router.delete("/api/v1/classes/{class_id}", response_model=ObjectResponse)
def remove_class(class_id: int) -> dict[str, object]:
    return delete_class(class_id)


@router.post("/api/v1/classes/{class_id}/students", response_model=ObjectResponse)
def post_class_student(class_id: int, payload: ClassStudentAddRequest) -> dict[str, object]:
    return add_student_to_class(class_id, payload.student_id)


@router.delete("/api/v1/classes/{class_id}/students/{student_id}", response_model=ObjectResponse)
def remove_class_student(class_id: int, student_id: str) -> dict[str, object]:
    return remove_student_from_class(class_id, student_id)


@router.get("/api/v1/classes/{class_id}/profile", response_model=ObjectResponse)
def get_class_profile_by_id(class_id: str) -> dict[str, object]:
    return get_class_profile(class_id)
