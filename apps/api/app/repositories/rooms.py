from typing import Any

from ..core.errors import ApiError
from ..core.runtime import is_initialized, mark_initialized
from ..db import fetch_one, fetch_rows, get_transaction_cursor
from ..utils.pagination import pager


def ensure_rooms_table() -> None:
    if is_initialized("rooms"):
        return
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS amilyhub.rooms (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                campus TEXT DEFAULT '' NOT NULL,
                capacity INTEGER DEFAULT 0 NOT NULL,
                status TEXT DEFAULT 'active' NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_rooms_name ON amilyhub.rooms(name)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_rooms_campus ON amilyhub.rooms(campus)")
    mark_initialized("rooms")


def _seed_default_room() -> None:
    """Seed a default room if the rooms table is empty."""
    count = fetch_one("SELECT COUNT(*) AS c FROM amilyhub.rooms")
    if count and int(count.get("c", 0) or 0) == 0:
        with get_transaction_cursor() as cur:
            cur.execute(
                """
                INSERT INTO amilyhub.rooms (name, campus, capacity, status)
                VALUES ('默认教室', '总校区', 30, 'active')
                ON CONFLICT DO NOTHING
                """
            )


def list_rooms(
    *,
    q: str | None,
    campus: str | None,
    status: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    ensure_rooms_table()
    _seed_default_room()
    page, page_size, offset = pager(page, page_size)
    clauses: list[str] = []
    params: list[Any] = []
    if q:
        clauses.append("name ilike %s")
        params.append(f"%{q}%")
    if campus:
        clauses.append("campus = %s")
        params.append(campus)
    if status:
        clauses.append("status = %s")
        params.append(status)
    condition = f" where {' and '.join(clauses)} " if clauses else ""
    total = fetch_one(f"select count(*) as c from amilyhub.rooms {condition}", tuple(params))["c"]
    rows = fetch_rows(
        f"""
        select id, name, campus, capacity, status, created_at, updated_at
        from amilyhub.rooms
        {condition}
        order by id desc
        limit %s offset %s
        """,
        tuple(params + [page_size, offset]),
    )
    return {"rows": rows, "page": page, "page_size": page_size, "total": total}


def create_room(*, name: str, campus: str, capacity: int, status: str) -> dict[str, Any]:
    ensure_rooms_table()
    with get_transaction_cursor() as cur:
        cur.execute(
            """
            insert into amilyhub.rooms (name, campus, capacity, status)
            values (%s, %s, %s, %s)
            returning id, name, campus, capacity, status, created_at, updated_at
            """,
            (name, campus, capacity, status),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def update_room(room_id: int, updates: dict[str, Any]) -> dict[str, Any]:
    ensure_rooms_table()
    set_clauses = [f"{key} = %s" for key in updates]
    set_clauses.append("updated_at = now()")
    values = list(updates.values()) + [room_id]
    with get_transaction_cursor() as cur:
        cur.execute(
            f"""
            update amilyhub.rooms set {', '.join(set_clauses)}
            where id = %s
            returning id, name, campus, capacity, status, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
        cols = [d.name for d in cur.description]
        if not row:
            raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
    return dict(zip(cols, row))


def delete_room(room_id: int) -> dict[str, Any]:
    ensure_rooms_table()
    with get_transaction_cursor() as cur:
        cur.execute("delete from amilyhub.rooms where id=%s returning id", (room_id,))
        row = cur.fetchone()
        if row is None:
            raise ApiError(404, "ROOM_NOT_FOUND", "room not found")
    return {"id": room_id}
