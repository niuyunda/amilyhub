from datetime import date

from pydantic import BaseModel, ConfigDict


class StudentUpsertRequest(BaseModel):
    source_student_id: str | None = None
    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birthday: date | None = None
    status: str | None = None
    source: str | None = None
    grade: str | None = None
    school: str | None = None
    tags: list[str] | None = None
    follow_up_person: str | None = None
    edu_manager: str | None = None
    wechat_bound: bool | None = None
    face_captured: bool | None = None


class StudentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    gender: str | None = None
    birthday: date | None = None
    status: str | None = None
    source: str | None = None
    grade: str | None = None
    school: str | None = None
    tags: list[str] | None = None
    follow_up_person: str | None = None
    edu_manager: str | None = None
    wechat_bound: bool | None = None
    face_captured: bool | None = None


class EnrollmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    course_name: str
    order_type: str = "报名"
    receivable_cents: int = 0
    received_cents: int = 0
    arrears_cents: int = 0
