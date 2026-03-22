from typing import Any

from ..db import fetch_one, fetch_rows
from .pagination import pager


def list_query(
    table: str,
    cols: str,
    clauses: list[str],
    params: list[Any],
    page: int,
    page_size: int,
    order_by: str = "id desc",
) -> dict[str, Any]:
    page, page_size, offset = pager(page, page_size)
    condition = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.{table} {condition}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select {cols}
        from amilyhub.{table}
        {condition}
        order by {order_by}
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"ok": True, "data": rows, "page": {"page": page, "page_size": page_size, "total": total}}
