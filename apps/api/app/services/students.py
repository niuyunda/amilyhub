from typing import Any

from ..repositories import students as students_repository
from ..utils.pagination import page_payload


def list_students(**kwargs: Any) -> dict[str, Any]:
    result = students_repository.list_students(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}


def get_student(source_student_id: str) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.get_student(source_student_id)}


def get_student_profile(source_student_id: str) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.get_student_profile(source_student_id)}


def create_student(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.create_student(payload)}


def update_student(source_student_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.update_student(source_student_id, payload)}


def delete_student(source_student_id: str, cascade: bool) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.delete_student(source_student_id, cascade)}


def enroll_student(source_student_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": students_repository.enroll_student(source_student_id, payload)}
