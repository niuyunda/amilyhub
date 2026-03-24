from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..routers.audit import router as audit_router
from ..routers.classes import router as classes_router
from ..routers.courses import router as courses_router
from ..routers.dashboard import router as dashboard_router
from ..routers.finance import router as finance_router
from ..routers.health import router as health_router
from ..routers.integrity import router as integrity_router
from ..routers.orders import router as orders_router
from ..routers.rbac import router as rbac_router
from ..routers.rollcalls import router as rollcalls_router
from ..routers.rooms import router as rooms_router
from ..routers.teachers import router as teachers_router
from ..routers.schedule_events import router as schedule_events_router
from ..routers.schedules import router as schedules_router
from ..routers.students import router as students_router
from .bootstrap import bootstrap_runtime_schema
from .config import settings
from .errors import register_exception_handlers


def create_app() -> FastAPI:
    bootstrap_runtime_schema()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        bootstrap_runtime_schema()
        yield

    app = FastAPI(title="AmilyHub API", version="v1", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(rbac_router)
    app.include_router(audit_router)
    app.include_router(dashboard_router)
    app.include_router(integrity_router)
    app.include_router(courses_router)
    app.include_router(rooms_router)
    app.include_router(schedule_events_router)
    app.include_router(schedules_router)
    app.include_router(teachers_router)
    app.include_router(students_router)
    app.include_router(orders_router)
    app.include_router(finance_router)
    app.include_router(classes_router)
    app.include_router(rollcalls_router)

    return app
