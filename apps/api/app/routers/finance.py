from datetime import date

from fastapi import APIRouter, Depends, Query, status

from ..dependencies.operator import OperatorContext, require_permission
from ..schemas.common import ListResponse, ObjectResponse
from ..schemas.finance import IncomeExpenseCreateRequest, IncomeExpenseUpdateRequest, IncomeExpenseVoidRequest
from ..services.finance import create_income_expense, income_expense_summary, list_hour_cost_flows, list_income_expense, update_income_expense, void_income_expense


router = APIRouter(tags=["finance"])


@router.get("/api/v1/hour-cost-flows", response_model=ListResponse)
def get_hour_cost_flows(student_id: str | None = Query(default=None), teacher_id: str | None = Query(default=None), cost_type: str | None = Query(default=None), source_type: str | None = Query(default=None), checked_from: date | None = Query(default=None), checked_to: date | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200)) -> dict[str, object]:
    return list_hour_cost_flows(student_id=student_id, teacher_id=teacher_id, cost_type=cost_type, source_type=source_type, checked_from=checked_from, checked_to=checked_to, page=page, page_size=page_size)


@router.post("/api/v1/income-expense", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
def post_income_expense(payload: IncomeExpenseCreateRequest, ctx: OperatorContext = Depends(require_permission("finance:write"))) -> dict[str, object]:
    return create_income_expense(payload.model_dump(mode="json"), ctx)


@router.put("/api/v1/income-expense/{source_record_id}", response_model=ObjectResponse)
def put_income_expense(source_record_id: str, payload: IncomeExpenseUpdateRequest, ctx: OperatorContext = Depends(require_permission("finance:write"))) -> dict[str, object]:
    return update_income_expense(source_record_id, payload.model_dump(mode="json", exclude_none=True), ctx)


@router.post("/api/v1/income-expense/{source_record_id}/void", response_model=ObjectResponse)
def post_income_expense_void(source_record_id: str, payload: IncomeExpenseVoidRequest | None = None, ctx: OperatorContext = Depends(require_permission("finance:write"))) -> dict[str, object]:
    operator = ((payload.operator if payload else None) or "system").strip() or "system"
    reason = ((payload.reason if payload else None) or "manual_void").strip() or "manual_void"
    return void_income_expense(source_record_id, operator, reason, ctx)


@router.get("/api/v1/income-expense", response_model=ListResponse)
def get_income_expense(q: str | None = Query(default=None), direction: str | None = Query(default=None), item_type: str | None = Query(default=None), status: str | None = Query(default=None), payment_method: str | None = Query(default=None), operation_date_from: date | None = Query(default=None), operation_date_to: date | None = Query(default=None), page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200)) -> dict[str, object]:
    return list_income_expense(q=q, direction=direction, item_type=item_type, status=status, payment_method=payment_method, operation_date_from=operation_date_from, operation_date_to=operation_date_to, page=page, page_size=page_size)


@router.get("/api/v1/income-expense/summary", response_model=ObjectResponse)
def get_income_expense_summary(direction: str | None = Query(default=None), operation_date_from: date | None = Query(default=None), operation_date_to: date | None = Query(default=None)) -> dict[str, object]:
    return income_expense_summary(direction=direction, operation_date_from=operation_date_from, operation_date_to=operation_date_to)
