export type NavKey = "dashboard" | "students" | "classes" | "schedules" | "attendance" | "courses";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  desc: string;
}

export const coreNavItems: NavItem[] = [
  { key: "dashboard", label: "工作台", href: "/dashboard", desc: "机构经营总览与待办" },
  { key: "students", label: "学员管理", href: "/students", desc: "学员生命周期管理" },
  { key: "classes", label: "班级管理", href: "/classes", desc: "班级容量与成员管理" },
  { key: "schedules", label: "课表管理", href: "/schedules", desc: "排课与教师时间安排" },
  { key: "attendance", label: "上课记录", href: "/attendance", desc: "考勤与消课记录" },
  { key: "courses", label: "课程管理", href: "/courses", desc: "课程体系与教材管理" },
];

export const pageTitleMap: Record<string, string> = Object.fromEntries(coreNavItems.map((item) => [item.href, item.label]));
