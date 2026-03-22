from fastapi import APIRouter, Depends, Query, status

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.orders import OrderActionRequest, OrderRenewalRequest, OrderUpdateRequest, OrderUpsertRequest
from ..services.orders import create_order, create_order_renewal, get_order, list_orders, refund_order, update_order, void_order


router = APIRouter(tags=["orders"])


@router.get("/api/v1/orders", response_model=ListResponse)
def get_orders(student_id: str | None = Query(default=None), state: str | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=200)) -> dict[str, object]:
    return list_orders(student_id=student_id, state=state, page=page, page_size=page_size)


@router.get("/api/v1/orders/{source_order_id}", response_model=ObjectResponse)
def get_order_by_id(source_order_id: str) -> dict[str, object]:
    return get_order(source_order_id)


@router.post("/api/v1/orders", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_order(payload: OrderUpsertRequest) -> dict[str, object]:
    return create_order(payload.model_dump(mode="json"))


@router.post("/api/v1/orders/renewal", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_order_renewal(payload: OrderRenewalRequest, ctx: OperatorContext = Depends(require_permission("orders:write"))) -> dict[str, object]:
    return create_order_renewal(payload.model_dump(mode="json"), ctx)


@router.put("/api/v1/orders/{source_order_id}", response_model=ObjectResponse)
def put_order(source_order_id: str, payload: OrderUpdateRequest) -> dict[str, object]:
    return update_order(source_order_id, payload.model_dump(mode="json", exclude_none=True))


@router.post("/api/v1/orders/{source_order_id}/void", response_model=ObjectResponse)
def post_order_void(source_order_id: str, payload: OrderActionRequest | None = None, ctx: OperatorContext = Depends(require_permission("orders:write"))) -> dict[str, object]:
    operator = (payload.operator if payload else None) or "system"
    reason = (payload.reason if payload else None) or "manual_void"
    return void_order(source_order_id, operator, reason, ctx)


@router.post("/api/v1/orders/{source_order_id}/refund", response_model=ObjectResponse)
def post_order_refund(source_order_id: str, payload: OrderActionRequest | None = None, ctx: OperatorContext = Depends(require_permission("orders:write"))) -> dict[str, object]:
    operator = (payload.operator if payload else None) or "system"
    reason = (payload.reason if payload else None) or "manual_refund"
    return refund_order(source_order_id, operator, reason, ctx)
