from typing import Any

from pydantic import BaseModel


class IntegrityIssue(BaseModel):
    kind: str
    table: str
    field: str | None = None
    value: str | None = None
    count: int
    note: str | None = None


class IntegrityCheckResponse(BaseModel):
    ok: bool = True
    data: dict[str, Any]
