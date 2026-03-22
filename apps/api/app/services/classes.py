from typing import Any

from ..repositories import classes as classes_repository
from ..utils.pagination import page_payload


def list_classes(**kwargs: Any) -> dict[str, Any]:
    result = classes_repository.list_classes(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}


def create_class(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.create_class(payload)}


def update_class(class_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.update_class(class_id, payload)}


def delete_class(class_id: int) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.delete_class(class_id)}


def add_student_to_class(class_id: int, student_id: str) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.add_student_to_class(class_id, student_id)}


def remove_student_from_class(class_id: int, student_id: str) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.remove_student_from_class(class_id, student_id)}


def get_class_profile(class_id: str) -> dict[str, Any]:
    return {"ok": True, "data": classes_repository.get_class_profile(class_id)}
