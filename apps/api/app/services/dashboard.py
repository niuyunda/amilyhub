from ..repositories.dashboard import fetch_dashboard_summary


def get_dashboard_summary() -> dict[str, object]:
    return {"ok": True, "data": fetch_dashboard_summary()}
