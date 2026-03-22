"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  ArrowUpCircle,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CirclePlus,
  ClipboardList,
  DoorOpen,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MoreVertical,
  PanelLeft,
  ReceiptText,
  Search,
  Settings,
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

const mainNavKeys: NavKey[] = ["dashboard", "students", "teachers", "classes", "rooms"];
const documentNavKeys: NavKey[] = ["schedules", "orders", "finance", "attendance"];
const moreNavKeys: NavKey[] = ["courses", "auditLogs", "rbac"];

const navItemMap = new Map<NavKey, NavItem>(coreNavItems.map((item) => [item.key, item]));

function getNavItems(keys: NavKey[]) {
  return keys
    .map((key) => navItemMap.get(key))
    .filter((item): item is NavItem => item !== undefined);
}

const mainNavItems = getNavItems(mainNavKeys);
const documentNavItems = getNavItems(documentNavKeys);
const moreNavItems = getNavItems(moreNavKeys);

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
          "group flex h-9 items-center rounded-md text-[13px] ring-1 ring-transparent transition-colors",
          collapsed ? "justify-center px-2" : "gap-2 px-2.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-sidebar-ring"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
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
  title?: string;
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {title && !collapsed ? (
        <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium tracking-wide text-sidebar-foreground/65">{title}</p>
      ) : null}
      {items.map((item) => (
        <NavLink key={item.key} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function UtilityLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = pathname === href;

  return (
    <Link href={href} onClick={onNavigate} title={label}>
      <span
        className={cn(
          "flex h-9 items-center rounded-md text-[13px] transition-colors",
          collapsed ? "justify-center px-2" : "gap-2 px-2.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {collapsed ? null : label}
      </span>
    </Link>
  );
}

function SidebarContent({
  pathname,
  user,
  collapsed,
  onNavigate,
  onQuickCreate,
  onLogout,
}: {
  pathname: string;
  user: OperatorUser;
  collapsed?: boolean;
  onNavigate?: () => void;
  onQuickCreate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-sidebar py-3 text-sidebar-foreground", collapsed ? "px-2" : "px-3")}> 
      <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2 px-1")}> 
        <ArrowUpCircle className="h-4 w-4 shrink-0" />
        {collapsed ? null : <h1 className="truncate text-base font-semibold tracking-tight">{appConfig.shortName} Inc.</h1>}
      </div>

      <Button
        className={cn(
          "mt-3 rounded-md bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
          collapsed ? "h-9 w-full justify-center px-0" : "h-9 w-full justify-start gap-2 px-3 text-sm",
        )}
        onClick={onQuickCreate}
        title="Quick Create"
      >
        <CirclePlus className="h-4 w-4" />
        {collapsed ? null : "Quick Create"}
      </Button>

      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pr-1">
        <NavSection items={mainNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="Documents" items={documentNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="More" items={moreNavItems} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className="space-y-1 border-t border-sidebar-border pt-2">
        <UtilityLink href="/rbac" label="Settings" icon={Settings} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <UtilityLink href="/audit-logs" label="Get Help" icon={CircleHelp} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <UtilityLink href="/students" label="Search" icon={Search} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      {collapsed ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-2 flex h-9 w-full items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {user.displayName.slice(0, 2)}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.username}@amilyhub.com</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-2 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                {user.displayName.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold leading-tight">{user.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.username}@amilyhub.com</span>
              </span>
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.roleLabel}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className="min-h-screen bg-sidebar">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
            isSidebarCollapsed ? "w-16" : "w-64",
          )}
        >
          <div className={cn("h-screen transition-[width] duration-200", isSidebarCollapsed ? "w-16" : "w-64")}>
            <SidebarContent
              pathname={pathname}
              user={user}
              collapsed={isSidebarCollapsed}
              onQuickCreate={() => router.push("/students")}
              onLogout={() => void handleLogout()}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
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
                  onQuickCreate={() => {
                    setMobileNavOpen(false);
                    router.push("/students");
                  }}
                  onLogout={() => void handleLogout()}
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

            <Separator orientation="vertical" className="hidden h-4 lg:block" />

            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium">{current.title}</h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden w-60 md:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 rounded-md border-border/70 bg-muted/35 pl-8 text-sm shadow-none"
                  placeholder="搜索学员、订单、课程"
                />
              </div>

              <Button variant="ghost" size="icon" aria-label="消息通知" className="h-8 w-8 rounded-md">
                <Bell className="h-4 w-4" />
              </Button>
              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 rounded-md px-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sidebar-primary text-[10px] font-semibold text-sidebar-primary-foreground">
                      {user.displayName.slice(0, 2)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">{user.username}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => void handleLogout()}>
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-4 lg:p-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
