from .audit import router as audit_router
from .dashboard import router as dashboard_router
from .health import router as health_router
from .integrity import router as integrity_router
from .rbac import router as rbac_router
from .rooms import router as rooms_router
from .schedule_events import router as schedule_events_router
from .teachers import router as teachers_router

__all__ = [
    "audit_router",
    "dashboard_router",
    "health_router",
    "integrity_router",
    "rbac_router",
    "rooms_router",
    "schedule_events_router",
    "teachers_router",
]
