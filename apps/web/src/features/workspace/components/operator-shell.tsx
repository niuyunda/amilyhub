"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  ReceiptText,
  Search,
  ShieldCheck,
  UserSquare2,
  Users,
  WalletCards,
  type LucideIcon,
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { appConfig } from "@/src/config/app";
import { coreNavItems, pageMetaMap, type NavItem, type NavKey } from "@/src/config/navigation";
import type { OperatorUser } from "@/src/features/auth/types";

const navIcons: Record<NavKey, LucideIcon> = {
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

const navItemMap = new Map<NavKey, NavItem>(coreNavItems.map((item) => [item.key, item]));
const workspaceNavKeys: NavKey[] = ["dashboard"];
const educationNavKeys: NavKey[] = ["students", "schedules", "courses", "classes", "teachers", "rooms", "attendance"];
const operationNavKeys: NavKey[] = ["orders", "finance"];
const otherNavKeys: NavKey[] = ["auditLogs", "rbac"];

function getNavItems(keys: NavKey[]) {
  return keys
    .map((key) => navItemMap.get(key))
    .filter((item): item is NavItem => item !== undefined);
}

const workspaceNavItems = getNavItems(workspaceNavKeys);
const educationNavItems = getNavItems(educationNavKeys);
const operationNavItems = getNavItems(operationNavKeys);
const otherNavItems = getNavItems(otherNavKeys);

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = pathname === item.href;
  const Icon = navIcons[item.key];

  return (
    <Link href={item.href} onClick={onNavigate} title={item.desc}>
      <span
        className={cn(
          "group relative flex h-9 items-center rounded-lg text-sm transition-all",
          collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        {active && !collapsed ? <span className="absolute left-0 top-2 h-5 w-0.5 rounded-full bg-sidebar-primary-foreground/70" /> : null}
        <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0", active ? "opacity-100" : "opacity-80 group-hover:opacity-100")} />
        {collapsed ? null : <span className="truncate">{item.label}</span>}
      </span>
    </Link>
  );
}

function NavSection({
  title,
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/45">
          {title}
        </p>
      ) : null}
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink key={item.key} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  user,
  collapsed,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  user: OperatorUser;
  collapsed?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-sidebar", collapsed ? "px-2 py-3" : "px-3 py-4")}>
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2 px-2")}>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary/12 text-sidebar-primary">
          <ArrowUpCircle className="h-[1.125rem] w-[1.125rem]" />
        </div>
        {collapsed ? null : (
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-sidebar-foreground">{appConfig.shortName}</h1>
            <p className="truncate text-[11px] text-sidebar-foreground/55">机构运营中台</p>
          </div>
        )}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <NavSection title="工作台" items={workspaceNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="教务" items={educationNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="运营" items={operationNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="其他" items={otherNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className={cn("mt-2 border-t border-sidebar-border pt-3", collapsed ? "px-0" : "px-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full rounded-lg transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed ? "flex h-9 items-center justify-center" : "flex items-center gap-2 px-2 py-1.5",
              )}
              type="button"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {user.displayName.slice(0, 2)}
              </span>
              {collapsed ? null : (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-sidebar-foreground">{user.displayName}</span>
                  <span className="block truncate text-xs text-sidebar-foreground/55">{user.roleLabel}</span>
                </span>
              )}
              {collapsed ? null : <ChevronDown className="h-4 w-4 text-sidebar-foreground/55" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{user.displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.roleLabel}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNavigate}>个人设置</DropdownMenuItem>
            <DropdownMenuItem onClick={onNavigate}>通知偏好</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const current = pageMetaMap[pathname] ?? {
    title: "工作台",
    desc: "机构经营总览与待办",
  };

  const todayText = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,var(--color-primary)_7%,transparent),transparent_45%),var(--color-muted)]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden overflow-hidden border-r border-sidebar-border/70 bg-sidebar/95 backdrop-blur transition-[width] duration-200 lg:flex",
            isSidebarCollapsed ? "w-[4.5rem]" : "w-[17rem]",
          )}
        >
          <div className={cn("h-screen transition-[width] duration-200", isSidebarCollapsed ? "w-[4.5rem]" : "w-[17rem]")}>
            <SidebarContent
              pathname={pathname}
              user={user}
              collapsed={isSidebarCollapsed}
              onLogout={() => void handleLogout()}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 p-2 lg:p-3">
          <div className="flex min-h-[calc(100vh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm lg:min-h-[calc(100vh-1.5rem)]">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/90 px-3 backdrop-blur sm:px-4">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="打开导航菜单">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[18rem] max-w-[88vw] border-r border-sidebar-border bg-sidebar p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{appConfig.name}</SheetTitle>
                  </SheetHeader>
                  <SidebarContent
                    pathname={pathname}
                    user={user}
                    onNavigate={() => setMobileNavOpen(false)}
                    onLogout={() => {
                      setMobileNavOpen(false);
                      void handleLogout();
                    }}
                  />
                </SheetContent>
              </Sheet>

              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-muted-foreground lg:inline-flex"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                aria-label="切换侧边栏"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="hidden h-5 lg:block" />

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-foreground">{current.title}</h1>
                <p className="hidden truncate text-xs text-muted-foreground md:block">{current.desc}</p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="relative hidden w-72 md:block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    className="h-9 rounded-lg border-border/70 bg-muted/40 pl-8 pr-14 text-sm shadow-none focus-visible:bg-background"
                    placeholder="搜索学员、订单、课程"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    ⌘K
                  </span>
                </div>

                <button
                  type="button"
                  className="hidden h-8 items-center rounded-md border border-border/70 bg-muted/30 px-2 text-xs text-muted-foreground sm:inline-flex"
                  title="今天"
                >
                  {todayText}
                </button>

                <Button variant="ghost" size="icon" aria-label="消息通知" className="h-8 w-8 rounded-md">
                  <Bell className="h-4 w-4" />
                </Button>

                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/30">
                  <ThemeToggle />
                </div>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-5">
              <div className="mx-auto w-full max-w-[1400px]">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
