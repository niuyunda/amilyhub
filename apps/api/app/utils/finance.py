import random
import time

from ..core.errors import ApiError


def generate_income_expense_id() -> str:
    return f"FIN{int(time.time() * 1000)}{random.randint(100, 999)}"


def normalize_direction(direction: str) -> str:
    value = str(direction or "").strip()
    if value in {"收入", "IN", "INCOME"}:
        return "收入"
    if value in {"支出", "OUT", "EXPENSE"}:
        return "支出"
    raise ApiError(422, "INVALID_DIRECTION", "direction must be 收入 or 支出")


def normalize_record_status(status: str | None) -> str:
    value = str((status or "正常")).strip()
    if value in {"正常", "有效", "normal", "NORMAL"}:
        return "正常"
    if value in {"作废", "VOID", "void", "voided", "VOIDED"}:
        return "作废"
    raise ApiError(422, "INVALID_RECORD_STATUS", "status must be 正常 or 作废")
