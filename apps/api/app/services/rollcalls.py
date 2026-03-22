from typing import Any

from ..repositories import rollcalls as rollcalls_repository
from ..utils.pagination import page_payload


def list_rollcalls(**kwargs: Any) -> dict[str, Any]:
    result = rollcalls_repository.list_rollcalls(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}


def get_rollcall_detail(source_id: str) -> dict[str, Any]:
    return {"ok": True, "data": rollcalls_repository.get_rollcall_detail(source_id)}


def confirm_rollcall(source_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "data": rollcalls_repository.confirm_rollcall(source_id, payload)}
