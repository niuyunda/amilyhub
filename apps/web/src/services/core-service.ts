import type {
  ClassRoom,
  CourseItem,
  DashboardData,
  FinanceRecord,
  AttendanceRecord,
  FinanceSummary,
  Order,
  ScheduleItem,
  Student,
  Teacher,
} from "@/src/types/domain";
import type {
  AttendanceQuery,
  ClassQuery,
  CourseQuery,
  FinanceQuery,
  OrderQuery,
  PageResult,
  ScheduleQuery,
  ServiceResult,
  StudentQuery,
  TeacherQuery,
} from "@/src/types/service";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:18765/api/v1";

type ApiList<T> = { ok: boolean; data: T[]; page: { page: number; page_size: number; total: number } };
type ApiObj<T> = { ok: boolean; data: T };

function toYuan(cents?: number | null): number {
  return Number(((cents ?? 0) / 100).toFixed(2));
}

function formatDateTime(v?: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function getJson<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const sp = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    });
  }
  const url = `${API_BASE}${path}${sp.toString() ? `?${sp.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json() as Promise<T>;
}

async function sendJson<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP_${res.status}`);
  }
  return res.json() as Promise<T>;
}

function mapStudentStatus(raw?: string): Student["status"] {
  if (!raw) return "在读";
  if (["NORMAL", "LEARNING", "在读", "active", "ACTIVE"].includes(raw)) return "在读";
  if (["停课", "SUSPENDED", "PAUSED"].includes(raw)) return "停课";
  return "结课";
}

function mapTeacherStatus(raw?: string): Teacher["status"] {
  if (raw === "在职" || raw === "ON" || raw === "NORMAL") return "在职";
  return "停用";
}

function mapOrderStatus(raw?: string): Order["status"] {
  if (raw === "PAID" || raw === "已支付") return "已支付";
  if (raw === "WAITING" || raw === "待支付") return "待支付";
  return "已作废";
}

function mapOrderType(raw?: string): Order["orderType"] {
  if (raw?.includes("REFUND") || raw === "退费") return "退费";
  if (raw?.includes("RENEW") || raw === "续费") return "续费";
  return "报名";
}

function ok<T>(data: T): ServiceResult<T> {
  return { kind: "ok", data };
}

export async function getDashboard(): Promise<ServiceResult<DashboardData>> {
  try {
    const s = await getJson<ApiObj<any>>("/dashboard/summary");
    return ok({
      kpi: {
        studentTotal: Number(s.data.students ?? 0),
        activeStudents: Number(s.data.active_students ?? 0),
        monthlyOrders: Number(s.data.orders ?? 0),
        monthlyIncomeYuan: toYuan(Number(s.data.income_cents ?? 0)),
        monthlyConsumedHours: Number(s.data.hour_cost_flows ?? 0),
      },
      todos: [
        { id: "rc", title: "待点名记录", count: Number(s.data.rollcalls ?? 0) },
        { id: "orders", title: "订单总数", count: Number(s.data.orders ?? 0) },
      ],
      quickActions: [
        { id: "student", label: "新增学员" },
        { id: "order", label: "新建订单" },
        { id: "class", label: "班级管理" },
        { id: "finance", label: "收支明细" },
      ],
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getStudents(query: StudentQuery): Promise<ServiceResult<PageResult<Student>>> {
  try {
    const r = await getJson<ApiList<any>>("/students", {
      q: query.keyword,
      status: query.status,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.source_student_id ?? x.id),
        name: x.name ?? "-",
        phone: x.phone ?? "-",
        gender: x.gender === "WOMEN" || x.gender === "女" ? "女" : "男",
        status: mapStudentStatus(x.status),
        consultant: x.consultant ?? "-",
        latestClassAt: formatDateTime(x.latest_class_at),
        remainHours: Number(x.remain_hours ?? 0),
        className: x.class_name ?? "-",
        age: Number.isFinite(Number(x.age)) ? Number(x.age) : null,
        birthday: x.birthday ? String(x.birthday) : "-",
        creator: x.creator ?? "-",
        createdAt: formatDateTime(x.source_created_at),
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getTeachers(query: TeacherQuery): Promise<ServiceResult<PageResult<Teacher>>> {
  try {
    const r = await getJson<ApiList<any>>("/teachers", {
      q: query.keyword,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.source_teacher_id ?? x.id),
        name: x.name ?? "-",
        phone: x.phone ?? "-",
        subject: "-",
        status: mapTeacherStatus(x.status),
        classCount: Number(x.current_month_lessons ?? 0),
        weeklyHours: Number(x.last_month_lessons ?? 0),
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getClasses(query: ClassQuery): Promise<ServiceResult<PageResult<ClassRoom>>> {
  try {
    const r = await getJson<ApiList<any>>("/classes", {
      q: query.keyword,
      teacher_name: query.teacherName,
      status: query.status,
      class_type: query.classType,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.id),
        name: x.name ?? "-",
        courseName: x.course_name ?? "-",
        teacherName: String(x.teacher_name ?? "-").replace(/[\[\]"]/g, ""),
        campus: x.campus ?? "-",
        studentCount: Number(x.student_count ?? 0),
        capacity: Number(x.capacity ?? 0),
        classType: x.class_type === "一对一" ? "一对一" : "班课",
        status: x.status === "已结班" ? "已结班" : "开班中",
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getClassProfile(classId: string): Promise<ServiceResult<any>> {
  try {
    const r = await getJson<ApiObj<any>>(`/classes/${encodeURIComponent(classId)}/profile`);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getCourses(query: CourseQuery): Promise<ServiceResult<PageResult<CourseItem>>> {
  try {
    const r = await getJson<ApiList<any>>("/courses", {
      q: query.keyword,
      course_type: query.courseType,
      status: query.status,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.id ?? "-"),
        courseName: x.course_name ?? "-",
        courseType: x.course_type === "一对一" ? "一对一" : "一对多",
        chargeType: x.charge_type ?? "按课时",
        pricingRules: x.pricing_rules ?? "-",
        pricingItems: Array.isArray(x.pricing_items)
          ? x.pricing_items.map((p: any) => ({
            name: String(p.name ?? ""),
            quantity: Number(p.quantity ?? 0),
            totalPrice: Number(p.totalPrice ?? 0),
          }))
          : undefined,
        activeStudents: Number(x.active_students ?? 0),
        status: x.status === "停用" ? "停用" : "启用",
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function createCourse(input: {
  name: string;
  courseType: "一对一" | "一对多";
  feeType: string;
  status: "启用" | "停用";
  pricingRules: string;
  pricingItems?: Array<{ name: string; quantity: number; totalPrice: number }>;
  studentNum?: number;
}): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("POST", "/courses", {
      name: input.name,
      course_type: input.courseType,
      fee_type: input.feeType,
      status: input.status,
      pricing_rules: input.pricingRules,
      pricing_items: input.pricingItems ?? [],
      student_num: input.studentNum ?? 0,
    });
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function updateCourse(courseId: string, input: {
  name: string;
  courseType: "一对一" | "一对多";
  feeType: string;
  status: "启用" | "停用";
  pricingRules: string;
  pricingItems?: Array<{ name: string; quantity: number; totalPrice: number }>;
  studentNum?: number;
}): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("PUT", `/courses/${encodeURIComponent(courseId)}`, {
      name: input.name,
      course_type: input.courseType,
      fee_type: input.feeType,
      status: input.status,
      pricing_rules: input.pricingRules,
      pricing_items: input.pricingItems ?? [],
      student_num: input.studentNum ?? 0,
    });
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function deleteCourse(courseId: string): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("DELETE", `/courses/${encodeURIComponent(courseId)}`);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getOrders(query: OrderQuery): Promise<ServiceResult<PageResult<Order>>> {
  try {
    const r = await getJson<ApiList<any>>("/orders", {
      student_id: query.studentId,
      state: query.status,
      page: query.page,
      page_size: query.pageSize,
    });
    const filtered = r.data.filter((x) => {
      const keyword = (query.keyword ?? "").toLowerCase();
      const kwOk = !keyword || String(x.source_order_id ?? "").toLowerCase().includes(keyword);
      const typeOk = !query.orderType || mapOrderType(x.order_type) === query.orderType;
      return kwOk && typeOk;
    });
    return ok({
      items: filtered.map((x) => ({
        id: String(x.id),
        orderNo: String(x.source_order_id ?? "-"),
        studentName: String(x.source_student_id ?? "-"),
        orderType: mapOrderType(x.order_type),
        status: mapOrderStatus(x.order_state),
        receivableYuan: toYuan(x.receivable_cents),
        paidYuan: toYuan(x.received_cents),
        arrearsYuan: toYuan(x.arrears_cents),
        createdAt: x.source_created_at ? String(x.source_created_at) : "-",
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getStudentProfile(studentId: string): Promise<ServiceResult<any>> {
  try {
    const r = await getJson<ApiObj<any>>(`/students/${encodeURIComponent(studentId)}/profile`);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function createStudent(input: {
  sourceStudentId?: string;
  name: string;
  phone?: string;
  gender?: "男" | "女";
  birthday?: string;
  status?: "在读" | "停课" | "结课";
}): Promise<ServiceResult<any>> {
  try {
    const payload = {
      source_student_id: input.sourceStudentId,
      name: input.name,
      phone: input.phone,
      gender: input.gender,
      birthday: input.birthday,
      status: input.status,
    };
    const r = await sendJson<ApiObj<any>>("POST", "/students", payload);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function updateStudent(studentId: string, input: {
  name?: string;
  phone?: string;
  gender?: "男" | "女";
  birthday?: string;
  status?: "在读" | "停课" | "结课";
}): Promise<ServiceResult<any>> {
  try {
    const payload = {
      name: input.name,
      phone: input.phone,
      gender: input.gender,
      birthday: input.birthday,
      status: input.status,
    };
    const r = await sendJson<ApiObj<any>>("PUT", `/students/${encodeURIComponent(studentId)}`, payload);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function deleteStudent(studentId: string, cascade = false): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("DELETE", `/students/${encodeURIComponent(studentId)}?cascade=${cascade ? "true" : "false"}`);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function enrollStudent(studentId: string, input: {
  courseName: string;
  receivableCents: number;
  receivedCents: number;
  arrearsCents: number;
  orderType?: "报名" | "试听";
}): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("POST", `/students/${encodeURIComponent(studentId)}/enroll`, {
      course_name: input.courseName,
      order_type: input.orderType ?? "报名",
      receivable_cents: input.receivableCents,
      received_cents: input.receivedCents,
      arrears_cents: input.arrearsCents,
    });
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function createRenewalOrder(input: {
  studentId: string;
  receivableCents: number;
  paidCents: number;
  arrearsCents: number;
}): Promise<ServiceResult<any>> {
  try {
    const r = await sendJson<ApiObj<any>>("POST", "/orders/renewal", {
      source_student_id: input.studentId,
      receivable_cents: input.receivableCents,
      received_cents: input.paidCents,
      arrears_cents: input.arrearsCents,
    });
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getSchedules(query: ScheduleQuery): Promise<ServiceResult<PageResult<ScheduleItem>>> {
  try {
    const r = await getJson<ApiList<any>>("/schedules", {
      view: query.view,
      q: query.keyword,
      date: query.date,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.id ?? "-"),
        viewKey: x.view_key ?? "-",
        dateTime: formatDateTime(x.date_time),
        timeRange: x.time_range ?? "-",
        className: x.class_name ?? "-",
        teacherName: String(x.teacher_name ?? "-").replace(/[\[\]"]/g, ""),
        roomName: x.room_name ?? "-",
        studentName: x.student_name ?? "-",
        status: x.status ?? "-",
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getAttendance(query: AttendanceQuery): Promise<ServiceResult<PageResult<AttendanceRecord>>> {
  try {
    const r = await getJson<ApiList<any>>("/rollcalls", {
      q: query.keyword,
      student_name: query.studentName,
      teacher_name: query.teacherName,
      class_name: query.className,
      status: query.status,
      date: query.date,
      rollcall_date_start: query.rollcallDateStart,
      rollcall_date_end: query.rollcallDateEnd,
      class_date_start: query.classDateStart,
      class_date_end: query.classDateEnd,
      page: query.page,
      page_size: query.pageSize,
    });
    return ok({
      items: r.data.map((x) => ({
        id: String(x.source_row_hash ?? x.id ?? "-"),
        className: x.class_name ?? "-",
        courseName: x.course_name ?? "-",
        teacherName: String(x.teacher_name ?? "-").replace(/[\[\]"]/g, ""),
        rollcallTime: x.rollcall_time ? String(x.rollcall_time) : "-",
        classTimeRange: x.class_time_range ?? "-",
        status: x.status ?? "-",
        teachingHours: Number(x.teaching_hours ?? 0),
        attendanceSummary: x.attendance_summary ?? "-",
        consumedAmountYuan: Number(x.cost_amount_cents ?? 0) / 100,
        studentNames: x.student_names ?? "-",
      })),
      page: r.page.page,
      pageSize: r.page.page_size,
      total: r.page.total,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getAttendanceDetail(sourceId: string): Promise<ServiceResult<any>> {
  try {
    const r = await getJson<ApiObj<any>>(`/rollcalls/${encodeURIComponent(sourceId)}`);
    return ok(r.data);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}

export async function getFinanceRecords(
  query: FinanceQuery,
): Promise<ServiceResult<{ list: PageResult<FinanceRecord>; summary: FinanceSummary }>> {
  try {
    const [list, summary] = await Promise.all([
      getJson<ApiList<any>>("/income-expense", {
        q: query.keyword,
        direction: query.direction,
        page: query.page,
        page_size: query.pageSize,
      }),
      getJson<ApiObj<any>>("/income-expense/summary", {
        q: query.keyword,
        direction: query.direction,
      }),
    ]);
    return ok({
      list: {
        items: list.data.map((x) => ({
          id: String(x.id),
          serialNo: String(x.source_id ?? "-"),
          bizType: x.item_type ?? "-",
          direction: x.direction === "支出" || x.direction === "EXPENSE" ? "支出" : "收入",
          amountYuan: toYuan(x.amount_cents),
          paymentMethod: "转账",
          operator: "-",
          occurredAt: x.operation_date ? String(x.operation_date) : "-",
        })),
        page: list.page.page,
        pageSize: list.page.page_size,
        total: list.page.total,
      },
      summary: {
        totalIncomeYuan: toYuan(summary.data.income_cents),
        totalExpenseYuan: toYuan(summary.data.expense_cents),
        netIncomeYuan: toYuan(summary.data.net_income_cents),
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { kind: "forbidden", message: "forbidden" };
    throw e;
  }
}
