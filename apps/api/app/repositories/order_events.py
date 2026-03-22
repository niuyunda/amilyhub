import json
from typing import Any


def create_order_event(
    cur: Any,
    source_order_id: str,
    event_type: str,
    payload: dict[str, Any],
    *,
    operator: str | None = None,
    reason: str | None = None,
) -> None:
    cur.execute(
        """
        insert into amilyhub.order_events(order_id, source_order_id, event_type, payload, operator, reason)
        values (%s, %s, %s, %s::jsonb, %s, %s)
        """,
        (
            source_order_id,
            source_order_id,
            event_type,
            json.dumps(payload, ensure_ascii=False, default=str),
            operator,
            reason,
        ),
    )


def has_order_event(cur: Any, source_order_id: str, event_type: str) -> bool:
    cur.execute(
        """
        select 1
        from amilyhub.order_events
        where source_order_id=%s and event_type=%s
        limit 1
        """,
        (source_order_id, event_type),
    )
    return cur.fetchone() is not None
