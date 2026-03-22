from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class IncomeExpenseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_record_id: str | None = None
    source_order_id: str | None = None
    item_type: str
    direction: str
    amount_cents: int = Field(ge=0)
    operation_date: date
    payment_method: str | None = None
    operator: str | None = None
    remark: str | None = None
    status: str = "正常"


class IncomeExpenseUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_order_id: str | None = None
    item_type: str | None = None
    direction: str | None = None
    amount_cents: int | None = Field(default=None, ge=0)
    operation_date: date | None = None
    payment_method: str | None = None
    operator: str | None = None
    remark: str | None = None
    status: str | None = None


class IncomeExpenseVoidRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator: str | None = None
    reason: str | None = None
