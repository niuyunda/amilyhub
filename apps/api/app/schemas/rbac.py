from pydantic import BaseModel, ConfigDict, Field


class RbacRoleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permissions: list[str] = Field(default_factory=list)
