"""Friendly, uniform error responses.

The API never returns a raw traceback or a bare ``500 Internal Server Error``.
Every failure is converted into::

    {"error": {"code": ..., "message": ..., "hint": ..., "fields": [...]}}

``message`` is always safe to show to an end user.
"""
from __future__ import annotations

import logging
from typing import Any, Iterable

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.ml.predictor import ModelNotReadyError, PredictionError

logger = logging.getLogger("airquality.errors")

GENERIC_MESSAGE = "Something went wrong while processing your request."
MODEL_NOT_READY_MESSAGE = (
    "The prediction model is not available yet. "
    "Run 'python -m backend.ml.train' in the project root, then reload the API."
)


def error_body(
    code: str,
    message: str,
    hint: str | None = None,
    fields: Iterable[dict[str, Any]] | None = None,
) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "hint": hint,
            "fields": list(fields or []),
        }
    }


class APIError(HTTPException):
    """HTTPException that already carries a user-safe payload."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        hint: str | None = None,
        fields: Iterable[dict[str, Any]] | None = None,
        headers: dict | None = None,
    ):
        super().__init__(status_code=status_code, detail=error_body(code, message, hint, fields))
        self.code = code
        self.message = message
        self.hint = hint


def bad_request(message: str, hint: str | None = None, fields: Iterable[dict] | None = None) -> APIError:
    return APIError(status.HTTP_400_BAD_REQUEST, "bad_request", message, hint, fields)


def not_found(message: str, hint: str | None = None) -> APIError:
    return APIError(status.HTTP_404_NOT_FOUND, "not_found", message, hint)


def unprocessable(message: str, hint: str | None = None, fields: Iterable[dict] | None = None) -> APIError:
    return APIError(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", message, hint, fields)


def service_unavailable(message: str, hint: str | None = None) -> APIError:
    return APIError(status.HTTP_503_SERVICE_UNAVAILABLE, "service_unavailable", message, hint)


def _flatten_validation_errors(exc: RequestValidationError) -> tuple[str, list[dict]]:
    """Turn Pydantic errors into one readable sentence plus per-field details."""
    fields: list[dict] = []
    parts: list[str] = []
    malformed = False

    for err in exc.errors():
        kind = err.get("type", "")
        if kind in {"json_invalid", "value_error.jsondecode"}:
            malformed = True
            break
        location = [str(p) for p in err.get("loc", []) if p not in ("body", "query")]
        field = location[-1] if location else "request"
        msg = err.get("msg", "invalid value")
        msg = msg.removeprefix("Value error, ")
        fields.append({"feature": field, "message": msg})
        parts.append(f"{field}: {msg}")

    if malformed:
        return (
            "The request body is not valid JSON.",
            [{"feature": "body", "message": "Send a JSON object such as {\"CO(GT)\": 2.6}."}],
        )

    summary = "The request could not be validated."
    if parts:
        summary = "; ".join(dict.fromkeys(parts))[:400]
    return summary, fields


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers so no internal error ever reaches the client verbatim."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)
        messages = {
            404: "The requested resource was not found.",
            405: "That method is not allowed for this endpoint.",
            413: "The uploaded file is too large.",
        }
        message = (
            detail
            if isinstance(detail, str)
            else messages.get(exc.status_code, GENERIC_MESSAGE)
        )
        code = {
            404: "not_found",
            405: "method_not_allowed",
            413: "payload_too_large",
        }.get(exc.status_code, "http_error")
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(code, message),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        summary, fields = _flatten_validation_errors(exc)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body(
                "validation_error",
                summary,
                "Check the highlighted values and try again.",
                fields,
            ),
        )

    @app.exception_handler(PredictionError)
    async def prediction_handler(request: Request, exc: PredictionError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_body(
                "validation_error",
                exc.message,
                "Adjust the highlighted readings and run the prediction again.",
                exc.errors,
            ),
        )

    @app.exception_handler(ModelNotReadyError)
    async def model_not_ready_handler(request: Request, exc: ModelNotReadyError):
        logger.warning("Model not ready: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=error_body(
                "model_not_ready",
                MODEL_NOT_READY_MESSAGE,
                str(exc),
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        # Log the real cause, return something a user can act on.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_body(
                "internal_error",
                GENERIC_MESSAGE,
                "If this keeps happening, restart the backend and check the server logs.",
            ),
        )


__all__ = [
    "APIError",
    "bad_request",
    "error_body",
    "not_found",
    "register_exception_handlers",
    "service_unavailable",
    "unprocessable",
]
