from pydantic import BaseModel, ConfigDict


class TeacherCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_teacher_id: str | None = None
    name: str
    phone: str | None = None
    subjects: list[str] | None = None
    status: str = "在职"


class TeacherUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    subjects: list[str] | None = None
    status: str | None = None


class TeacherStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
