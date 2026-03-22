from ..core.errors import ApiError
from ..db import fetch_one


def assert_student_exists(source_student_id: str) -> None:
    row = fetch_one("select 1 as ok from amilyhub.students where source_student_id=%s", (source_student_id,))
    if not row:
        raise ApiError(422, "STUDENT_NOT_FOUND", "student not found for provided source_student_id")
