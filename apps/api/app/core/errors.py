from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ..schemas.common import ErrorInfo, ErrorResponse


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def build_api_error_response(exc: object) -> JSONResponse:
    status_code = getattr(exc, "status_code")
    code = getattr(exc, "code")
    message = getattr(exc, "message")
    details = getattr(exc, "details", None)
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(error=ErrorInfo(code=code, message=message, details=details)).model_dump(),
    )


def register_api_error_handler(app: FastAPI, error_type: type[Exception]) -> None:
    @app.exception_handler(error_type)
    def api_error_handler(_: Request, exc: Exception) -> JSONResponse:
        return build_api_error_response(exc)


def register_exception_handlers(app: FastAPI) -> None:
    register_api_error_handler(app, ApiError)

    @app.exception_handler(RequestValidationError)
    def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error=ErrorInfo(code="VALIDATION_ERROR", message="invalid request", details={"errors": exc.errors()})
            ).model_dump(),
        )
