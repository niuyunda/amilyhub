from pydantic import BaseModel, ConfigDict, Field


class RoomCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    campus: str = ""
    capacity: int = Field(default=0, ge=0)
    status: str = "active"


class RoomUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    campus: str | None = None
    capacity: int | None = Field(default=None, ge=0)
    status: str | None = None
