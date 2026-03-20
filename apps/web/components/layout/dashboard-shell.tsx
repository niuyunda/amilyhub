"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, ChevronDown, LayoutDashboard, Search, Users, UserSquare2, GraduationCap, ReceiptText, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { coreNavItems } from "@/src/constants/navigation";
import type { CurrentUser } from "@/src/types/domain";

const currentUser: CurrentUser = {
  id: "u-1",
  name: "管理员",
  role: "超级管理员",
};

const pageMeta: Record<string, { title: string; desc: string }> = Object.fromEntries(
  coreNavItems.map((item) => [item.href, { title: item.label, desc: item.desc }]),
);

const navIcons = {
  dashboard: LayoutDashboard,
  students: Users,
  teachers: UserSquare2,
  classes: GraduationCap,
  orders: ReceiptText,
  finance: WalletCards,
} as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = pageMeta[pathname] ?? { title: "工作台", desc: "机构经营总览与待办" };

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-none border bg-background shadow-sm max-lg:grid-cols-1">
        <aside className="border-r border-sidebar-border bg-sidebar/60 p-4 text-sidebar-foreground max-lg:border-b max-lg:border-r-0">
          <div className="rounded-xl bg-card px-3 py-3 text-lg font-bold text-sidebar-foreground">AmilyHub 教务系统</div>
          <nav className="mt-4 space-y-1 max-lg:flex max-lg:space-x-1 max-lg:space-y-0 max-lg:overflow-x-auto max-lg:pb-1">
            {coreNavItems.map((item) => {
              const active = pathname === item.href;
              const Icon = navIcons[item.key];
              return (
                <Link key={item.key} href={item.href} className="max-lg:flex-shrink-0">
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className="h-10 w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground max-lg:w-auto max-lg:whitespace-nowrap"
                    data-active={active}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b bg-background/90 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
                <h1 className="text-xl font-semibold">{current.title}</h1>
                <p className="text-sm text-muted-foreground/90">{current.desc}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative hidden w-64 lg:block">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="全局搜索（学员/订单）" />
                </div>
                <Button variant="ghost" size="icon" aria-label="消息通知">
                  <Bell className="h-4 w-4" />
                </Button>
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      {currentUser.name}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{currentUser.role}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>个人中心</DropdownMenuItem>
                    <DropdownMenuItem>修改密码</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>退出登录</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
