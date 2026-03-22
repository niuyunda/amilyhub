from typing import Any

from fastapi import Query


def pager(page: int, page_size: int) -> tuple[int, int, int]:
    normalized_page = max(page, 1)
    normalized_page_size = min(max(page_size, 1), 200)
    return normalized_page, normalized_page_size, (normalized_page - 1) * normalized_page_size


def page_query(default_page_size: int = 50) -> tuple[int, int]:
    return (
        Query(default=1, ge=1),
        Query(default=default_page_size, ge=1, le=200),
    )


def page_payload(*, page: int, page_size: int, total: int) -> dict[str, int]:
    return {"page": page, "page_size": page_size, "total": total}


def as_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)
