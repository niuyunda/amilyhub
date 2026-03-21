export type NavKey =
  | "dashboard"
  | "students"
  | "teachers"
  | "classes"
  | "schedules"
  | "orders"
  | "finance"
  | "attendance"
  | "courses"
  | "auditLogs";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  desc: string;
}

export const coreNavItems: NavItem[] = [
  { key: "dashboard", label: "工作台", href: "/dashboard", desc: "机构经营总览与待办" },
  { key: "students", label: "学员管理", href: "/students", desc: "学员生命周期管理" },
  { key: "teachers", label: "老师管理", href: "/teachers", desc: "老师档案与启停管理" },
  { key: "classes", label: "班级管理", href: "/classes", desc: "班级容量与成员管理" },
  { key: "schedules", label: "课表管理", href: "/schedules", desc: "排课与教师时间安排" },
  { key: "orders", label: "订单管理", href: "/orders", desc: "报名续费退费订单管理" },
  { key: "finance", label: "收支管理", href: "/finance", desc: "收支台账与统计汇总" },
  { key: "attendance", label: "上课记录", href: "/attendance", desc: "考勤与消课记录" },
  { key: "courses", label: "课程管理", href: "/courses", desc: "课程体系与教材管理" },
  { key: "auditLogs", label: "审计日志", href: "/audit-logs", desc: "关键操作审计追踪" },
];

export const pageTitleMap: Record<string, string> = Object.fromEntries(coreNavItems.map((item) => [item.href, item.label]));
