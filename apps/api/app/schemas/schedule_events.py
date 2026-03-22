from pydantic import BaseModel, ConfigDict


class ScheduleEventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_name: str
    teacher_name: str
    start_time: str
    end_time: str
    room_name: str | None = None
    room_id: int | None = None
    status: str = "planned"
    source_course_id: str | None = None
    source_class_id: str | None = None
    note: str | None = None
