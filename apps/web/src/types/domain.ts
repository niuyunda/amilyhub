export type UserRole = "超级管理员" | "教务" | "财务" | "老师";

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface DashboardKpi {
  studentTotal: number;
  activeStudents: number;
  monthlyOrders: number;
  monthlyClasses: number;
  monthlyIncomeYuan: number;
  monthlyConsumedHours: number;
}

export interface TodoItem {
  id: string;
  title: string;
  count: number;
}

export interface QuickAction {
  id: string;
  label: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  gender: "男" | "女";
  status: "在读" | "停课" | "结课";
  consultant: string;
  latestClassAt: string;
  remainHours: number;
  className: string;
  age: number | null;
  birthday: string;
  creator: string;
  createdAt: string;
  source?: string;
  grade?: string;
  school?: string;
  tags?: string[];
  followUpPerson?: string;
  eduManager?: string;
  wechatBound?: boolean;
  faceCaptured?: boolean;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  subjects: string[];
  subject: string;
  status: "在职" | "停用";
  classCount: number;
  weeklyHours: number;
  actions: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  courseName: string;
  teacherName: string;
  campus: string;
  studentCount: number;
  capacity: number;
  classType: "班课" | "一对一";
  status: "开班中" | "已结班";
  sourceClassId?: string;
  courseId?: string;
  teacherId?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface CourseItem {
  id: string;
  courseName: string;
  courseType: "一对一" | "一对多";
  chargeType: string;
  pricingRules: string;
  pricingItems?: Array<{ name: string; quantity: number; totalPrice: number }>;
  activeStudents: number;
  status: "启用" | "停用";
  validityDays?: number;
  description?: string;
  materials?: string[];
}

export interface Order {
  id: string;
  orderNo: string;
  studentName: string;
  orderType: "报名" | "续费" | "退费";
  status: "待支付" | "已支付" | "已作废";
  receivableYuan: number;
  paidYuan: number;
  arrearsYuan: number;
  createdAt: string;
}

export interface FinanceRecord {
  id: string;
  serialNo: string;
  bizType: string;
  direction: "收入" | "支出";
  amountYuan: number;
  paymentMethod: "微信" | "支付宝" | "现金" | "转账";
  operator: string;
  remark: string;
  status: "正常" | "作废";
  occurredAt: string;
  actions: string;
}

export interface FinanceSummary {
  totalIncomeYuan: number;
  totalExpenseYuan: number;
  netIncomeYuan: number;
}

export interface ScheduleItem {
  id: string;
  viewKey: string;
  dateTime: string;
  timeRange: string;
  className: string;
  teacherName: string;
  roomName: string;
  studentName: string;
  status: string;
}

export interface ScheduleEvent {
  id: number;
  className: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  roomName?: string;
  roomId?: number;
  status?: string;
  note?: string;
  sourceCourseId?: string;
  sourceClassId?: string;
}

export interface Room {
  id: string;
  name: string;
  campus: string;
  capacity: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  className: string;
  courseName: string;
  teacherName: string;
  rollcallTime: string;
  classTimeRange: string;
  status: string;
  teachingHours: number;
  attendanceSummary: string;
  consumedAmountYuan: number;
  studentNames: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  operator: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId: string;
}

export interface RbacRoleItem {
  role: string;
  permissions: string[];
}

export interface DashboardData {
  kpi: DashboardKpi;
  todos: TodoItem[];
  quickActions: QuickAction[];
}
