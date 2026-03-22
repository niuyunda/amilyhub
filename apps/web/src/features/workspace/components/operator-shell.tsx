"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Search,
  ShieldCheck,
  UserSquare2,
  Users,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { appConfig } from "@/src/config/app";
import { coreNavItems, pageMetaMap, type NavKey } from "@/src/config/navigation";
import type { OperatorUser } from "@/src/features/auth/types";

const navIcons: Record<NavKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  students: Users,
  teachers: UserSquare2,
  classes: GraduationCap,
  rooms: DoorOpen,
  schedules: CalendarDays,
  orders: ReceiptText,
  finance: WalletCards,
  attendance: ClipboardList,
  courses: BookOpen,
  auditLogs: FileClock,
  rbac: ShieldCheck,
};

function ShellNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {coreNavItems.map((item) => {
        const active = pathname === item.href;
        const Icon = navIcons[item.key];
        return (
          <Link key={item.key} href={item.href} onClick={onNavigate}>
            <span
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function OperatorShell({
  children,
  user,
}: {
  children: ReactNode;
  user: OperatorUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const current = pageMetaMap[pathname] ?? {
    title: "工作台",
    desc: "机构经营总览与待办",
  };

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(77,124,255,0.16),_transparent_35%),linear-gradient(180deg,_rgba(247,248,252,1)_0%,_rgba(241,244,249,1)_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-3 lg:p-4">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col rounded-[28px] border border-white/60 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="px-2 pb-6">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {appConfig.shortName}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{appConfig.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Agent-first operator workspace</p>
            </div>
            <ShellNav pathname={pathname} />
            <div className="mt-auto rounded-2xl border bg-muted/40 p-3">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col rounded-[28px] border border-white/60 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-white/80 px-4 py-4 backdrop-blur lg:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] sm:max-w-[300px]">
                    <SheetHeader>
                      <SheetTitle>{appConfig.name}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <ShellNav pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Protected Workspace</p>
                  <h2 className="truncate text-2xl font-semibold tracking-tight">{current.title}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{current.desc}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="relative hidden w-64 xl:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-10 rounded-xl border-white/60 bg-muted/40 pl-9" placeholder="搜索学员、订单、课程" />
                </div>
                <Button variant="ghost" size="icon" aria-label="消息通知">
                  <Bell className="h-4 w-4" />
                </Button>
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-xl">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {user.displayName.slice(0, 2)}
                      </span>
                      <span className="hidden text-left sm:block">
                        <span className="block text-sm font-medium">{user.displayName}</span>
                        <span className="block text-xs text-muted-foreground">{user.roleLabel}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <p className="font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">{user.username}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleLogout()}>退出登录</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
