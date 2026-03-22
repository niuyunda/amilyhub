from fastapi import APIRouter, Query

from ..schemas.integrity import IntegrityCheckResponse
from ..services.integrity import check_data_integrity


router = APIRouter(tags=["integrity"])


@router.get("/api/v1/data/integrity", response_model=IntegrityCheckResponse)
def get_data_integrity(limit: int = Query(default=20, ge=1, le=200)) -> dict[str, object]:
    return check_data_integrity(limit=limit)
