from pydantic import BaseModel, ConfigDict


class RollcallConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = "正常"
    operator: str | None = None
    reason: str | None = None
