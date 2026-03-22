from datetime import date

from pydantic import BaseModel, ConfigDict


class ClassCreateRequest(BaseModel):
    source_class_id: int
    name: str
    type: str = "班课"
    course_id: str | None = None
    teacher_id: str | None = None
    campus: str = ""
    capacity: int = 0
    description: str = ""
    start_date: date | None = None
    end_date: date | None = None
    status: str = "开班中"


class ClassUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    type: str | None = None
    course_id: str | None = None
    teacher_id: str | None = None
    campus: str | None = None
    capacity: int | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None


class ClassStudentAddRequest(BaseModel):
    student_id: str
