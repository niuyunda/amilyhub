export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListQuery extends PageRequest {
  keyword?: string;
}

export interface StudentQuery extends ListQuery {
  status?: "在读" | "停课" | "结课";
}

export interface TeacherQuery extends ListQuery {
  status?: "在职" | "停用";
}

export interface ClassQuery extends ListQuery {
  status?: "开班中" | "已结班";
  teacherName?: string;
  classType?: "班课" | "一对一";
}

export interface CourseQuery extends ListQuery {
  courseType?: "一对一" | "一对多";
  status?: "启用" | "停用";
}

export interface OrderQuery extends ListQuery {
  status?: "待支付" | "已支付" | "已作废";
  orderType?: "报名" | "续费" | "退费";
  studentId?: string;
}

export interface FinanceQuery extends ListQuery {
  direction?: "收入" | "支出";
}

export interface ScheduleQuery extends ListQuery {
  view: "time" | "teacher" | "room" | "class";
  date?: string;
}

export interface AttendanceQuery extends ListQuery {
  studentName?: string;
  teacherName?: string;
  className?: string;
  status?: string;
  date?: string;
  rollcallDateStart?: string;
  rollcallDateEnd?: string;
  classDateStart?: string;
  classDateEnd?: string;
}

export interface AuditLogQuery {
  action?: string;
  operator?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

export type ServiceResult<T> = { kind: "ok"; data: T } | { kind: "forbidden"; message: string };
