from typing import Any

from ..repositories.courses import create_course_db, delete_course_db, list_courses_db, update_course_db


def list_courses(
    *,
    q: str | None,
    course_type: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    result = list_courses_db(q=q, course_type=course_type, status=status, page=page, page_size=page_size)
    return {
        "ok": True,
        "data": result["rows"],
        "page": {"page": result["page"], "page_size": result["page_size"], "total": result["total"]},
    }


def create_course(*, payload: dict[str, Any]) -> dict[str, Any]:
    data = create_course_db(payload)
    return {"ok": True, "data": data}


def update_course(*, course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = update_course_db(course_id, payload)
    return {"ok": True, "data": data}


def delete_course(*, course_id: str) -> dict[str, Any]:
    data = delete_course_db(course_id)
    return {"ok": True, "data": data}
