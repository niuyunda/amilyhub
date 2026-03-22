from pydantic import BaseModel, ConfigDict, Field


class OrderUpsertRequest(BaseModel):
    source_order_id: str = Field(min_length=1)
    source_student_id: str | None = None
    order_type: str | None = None
    order_state: str | None = None
    receivable_cents: int | None = None
    received_cents: int | None = None
    arrears_cents: int | None = None


class OrderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_student_id: str | None = None
    order_type: str | None = None
    order_state: str | None = None
    receivable_cents: int | None = None
    received_cents: int | None = None
    arrears_cents: int | None = None


class OrderRenewalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_student_id: str
    receivable_cents: int = 0
    received_cents: int = 0
    arrears_cents: int = 0


class OrderActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: str | None = None
    reason: str | None = None
