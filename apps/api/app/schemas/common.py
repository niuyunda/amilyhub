from typing import Any

from pydantic import BaseModel


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    ok: bool = False
    error: ErrorInfo


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int


class ListResponse(BaseModel):
    ok: bool = True
    data: list[dict[str, Any]]
    page: PageMeta


class ObjectResponse(BaseModel):
    ok: bool = True
    data: dict[str, Any]
