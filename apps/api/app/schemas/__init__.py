from .common import ErrorInfo, ErrorResponse, ListResponse, ObjectResponse, PageMeta
from .dashboard import DashboardSummary, DashboardSummaryResponse
from .integrity import IntegrityCheckResponse, IntegrityIssue
from .rbac import RbacRoleUpdateRequest
from .rooms import RoomCreateRequest, RoomUpdateRequest
from .schedule_events import ScheduleEventCreateRequest
from .teachers import TeacherCreateRequest, TeacherStatusUpdateRequest, TeacherUpdateRequest

__all__ = [
    "ErrorInfo",
    "ErrorResponse",
    "DashboardSummary",
    "DashboardSummaryResponse",
    "IntegrityCheckResponse",
    "IntegrityIssue",
    "ListResponse",
    "ObjectResponse",
    "PageMeta",
    "RbacRoleUpdateRequest",
    "RoomCreateRequest",
    "RoomUpdateRequest",
    "ScheduleEventCreateRequest",
    "TeacherCreateRequest",
    "TeacherStatusUpdateRequest",
    "TeacherUpdateRequest",
]
