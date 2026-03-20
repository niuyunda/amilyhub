from contextlib import contextmanager
import psycopg
from .config import settings


@contextmanager
def get_conn():
    conn = psycopg.connect(settings.database_url)
    try:
        yield conn
    finally:
        conn.close()


def fetch_rows(sql: str, params: tuple = ()):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d.name for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            return rows


def fetch_one(sql: str, params: tuple = ()):
    rows = fetch_rows(sql, params)
    return rows[0] if rows else None
