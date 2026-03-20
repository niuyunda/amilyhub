export type NavKey = "dashboard" | "students" | "teachers" | "classes" | "orders" | "finance";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  desc: string;
}

export const coreNavItems: NavItem[] = [
  { key: "dashboard", label: "工作台", href: "/dashboard", desc: "机构经营总览与待办" },
  { key: "students", label: "学员管理", href: "/students", desc: "学员生命周期管理" },
  { key: "teachers", label: "老师管理", href: "/teachers", desc: "教师资料与授课安排" },
  { key: "classes", label: "班级管理", href: "/classes", desc: "班级容量与成员管理" },
  { key: "orders", label: "订单管理", href: "/orders", desc: "报名续费退费订单管理" },
  { key: "finance", label: "收支明细", href: "/finance", desc: "财务台账与净收入统计" },
];

export const pageTitleMap: Record<string, string> = Object.fromEntries(coreNavItems.map((item) => [item.href, item.label]));
