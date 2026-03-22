import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse
from ..services.audit import list_audit_logs


router = APIRouter(tags=["audit"])


@router.get("/api/v1/audit-logs", response_model=ListResponse)
def get_audit_logs(
    _: OperatorContext = Depends(require_permission("audit:read")),
    action: str | None = Query(default=None),
    operator: str | None = Query(default=None),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, object]:
    rows = list_audit_logs(action=action, operator=operator, start_time=start_time, end_time=end_time, limit=limit)
    return {"ok": True, "data": rows, "page": {"page": 1, "page_size": len(rows), "total": len(rows)}}


@router.get("/api/v1/audit-logs/export.csv")
def export_audit_logs_csv(
    _: OperatorContext = Depends(require_permission("audit:read")),
    action: str | None = Query(default=None),
    operator: str | None = Query(default=None),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> Response:
    rows = list_audit_logs(action=action, operator=operator, start_time=start_time, end_time=end_time, limit=limit)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["created_at", "operator", "role", "action", "resource_type", "resource_id"])
    for row in rows:
        writer.writerow([
            row.get("created_at") or "",
            row.get("operator") or "",
            row.get("role") or "",
            row.get("action") or "",
            row.get("resource_type") or "",
            row.get("resource_id") or "",
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )
