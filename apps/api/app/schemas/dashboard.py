from pydantic import BaseModel


class DashboardSummary(BaseModel):
    students: int
    active_students: int
    teachers: int
    orders: int
    hour_cost_flows: int
    rollcalls: int
    income_expense: int
    monthly_classes: int
    income_cents: int
    expense_cents: int
    net_income_cents: int
    receivable_cents: int
    received_cents: int
    arrears_cents: int


class DashboardSummaryResponse(BaseModel):
    ok: bool = True
    data: DashboardSummary
