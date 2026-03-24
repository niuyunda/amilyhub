from typing import Any

from ..repositories import schedules as schedules_repository
from ..utils.pagination import page_payload


def list_schedules(**kwargs: Any) -> dict[str, Any]:
    result = schedules_repository.list_schedules(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}


def list_schedules_hcf(**kwargs: Any) -> dict[str, Any]:
    result = schedules_repository.list_schedules_hcf(**kwargs)
    return {"ok": True, "data": result["rows"], "page": page_payload(page=result["page"], page_size=result["page_size"], total=result["total"])}
