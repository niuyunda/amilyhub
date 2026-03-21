"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Search, Users, UserSquare2, GraduationCap, CalendarDays, ReceiptText, WalletCards, PanelLeft, ClipboardList, BookOpen, FileClock, ShieldCheck } from "lucide-react";

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
  schedules: CalendarDays,
  orders: ReceiptText,
  finance: WalletCards,
  attendance: ClipboardList,
  courses: BookOpen,
  auditLogs: FileClock,
  rbac: ShieldCheck,
} as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = pageMeta[pathname] ?? { title: "工作台", desc: "机构经营总览与待办" };
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  function handleLogout() {
    // 清除认证 cookie（设置过期时间为过去）
    document.cookie = "amilyhub_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-sidebar overflow-hidden">
      <div
        className="grid min-h-screen transition-[grid-template-columns] duration-300 ease-in-out max-lg:grid-cols-1"
        style={{ gridTemplateColumns: isSidebarOpen ? "250px minmax(0,1fr)" : "0px minmax(0,1fr)" }}
      >
        <aside className="relative z-10 flex flex-col overflow-hidden text-sidebar-foreground max-lg:border-b max-lg:h-auto">
          <div className="flex w-[250px] flex-col h-full bg-sidebar">
            <div className="flex h-[3.5rem] items-center gap-2 px-4 border-b border-transparent">
              <span className="font-semibold text-sm">Amily 爱米粒</span>
            </div>

            <div className="flex-1 overflow-auto py-4 scrollbar-none">
              <nav className="px-2 space-y-1 max-lg:flex max-lg:space-x-1 max-lg:space-y-0 max-lg:overflow-x-auto max-lg:px-4">
                {coreNavItems.map((item) => {
                  const active = pathname === item.href;
                  const Icon = navIcons[item.key];
                  return (
                    <Link key={item.key} href={item.href} className="block w-full max-lg:flex-shrink-0">
                      <Button
                        variant="ghost"
                        className={`h-8 w-full justify-start gap-2 px-2 text-sm max-lg:w-auto cursor-pointer ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground ${active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground font-normal"
                          }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8 px-4 max-lg:hidden">
                <h4 className="mb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">系统设置</h4>
                <nav className="space-y-1 -mx-2">
                  <Button variant="ghost" className="h-8 w-full justify-start gap-2 px-2 text-sm font-normal text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground cursor-pointer">
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                </nav>
              </div>
            </div>

            <div className="mt-auto border-t border-sidebar-border/50 p-2 max-lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground cursor-pointer transition-colors text-sidebar-foreground outline-none">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                      {currentUser.name.slice(0, 2)}
                    </div>
                    <div className="flex flex-col text-left text-sm leading-tight truncate">
                      <span className="font-semibold truncate">{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{currentUser.role}</span>
                    </div>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{currentUser.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col p-2 max-lg:p-0">
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-sm max-lg:rounded-none max-lg:border-0 relative">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur max-lg:px-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted hidden lg:flex"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                  <div className="hidden h-4 w-[1px] bg-border lg:block" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="max-sm:hidden">{current.title}</span>
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative hidden w-64 md:block">
                  <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="h-9 pl-8 bg-muted/50 border-transparent hover:bg-muted/80 focus:bg-background transition-colors" placeholder="搜索（学员/订单）" />
                </div>
                <Button variant="ghost" size="icon" aria-label="消息通知" className="h-8 w-8 rounded-full">
                  <Bell className="h-4 w-4" />
                </Button>
                <div className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent/50">
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6 bg-background">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
