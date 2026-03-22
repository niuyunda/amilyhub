import pathlib
import sys

from fastapi.routing import APIRoute

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from app.api import app
from app.config import settings


def test_app_includes_extracted_and_legacy_routes():
    routes = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in app.routes
        if isinstance(route, APIRoute)
    }

    assert ("/api/v1/health", ("GET",)) in routes
    assert ("/api/v1/rooms", ("GET",)) in routes
    assert ("/api/v1/teachers", ("GET",)) in routes
    assert ("/api/v1/schedule-events", ("GET",)) in routes
    assert ("/api/v1/rbac/roles", ("GET",)) in routes
    assert ("/api/v1/audit-logs", ("GET",)) in routes
    assert ("/api/v1/students", ("GET",)) in routes
    assert ("/api/v1/orders", ("POST",)) in routes


def test_cors_defaults_are_environment_driven_and_not_wildcard():
    assert settings.cors_allowed_origins
    assert "*" not in settings.cors_allowed_origins
