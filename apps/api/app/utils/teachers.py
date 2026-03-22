import random
import time

from ..core.errors import ApiError


def generate_teacher_id() -> str:
    return f"TCH{int(time.time() * 1000)}{random.randint(100, 999)}"


def normalize_teacher_status(status: str | None) -> str:
    value = (status or "在职").strip()
    if value in {"在职", "启用", "active", "ACTIVE", "ON", "NORMAL"}:
        return "在职"
    if value in {"停用", "禁用", "离职", "inactive", "INACTIVE", "OFF", "DISABLED"}:
        return "停用"
    raise ApiError(422, "INVALID_TEACHER_STATUS", "invalid teacher status")


def normalize_subjects(subjects: list[str] | None) -> list[str]:
    cleaned: list[str] = []
    for subject in subjects or []:
        name = str(subject or "").strip()
        if name:
            cleaned.append(name)
    return cleaned[:20]
