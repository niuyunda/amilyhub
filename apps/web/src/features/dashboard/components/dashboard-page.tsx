"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Columns2,
  GripVertical,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardOverview } from "@/src/data/core/dashboard";
import type { DashboardData } from "@/src/types/domain";

type DashboardStatus = "loading" | "ready" | "error" | "forbidden";
type MetricTrend = "up" | "down";
type RangeKey = "90d" | "30d" | "7d";
type ViewTab = "outline" | "performance" | "personnel" | "documents";
type DashboardColumnKey = "target" | "limit" | "reviewer";

type MetricCardData = {
  title: string;
  value: string;
  delta: string;
  trend: MetricTrend;
  note: string;
  subNote: string;
};

type OutlineRow = {
  id: string;
  title: string;
  type: string;
  target: number;
  limit: number;
  reviewer: string;
  tab: ViewTab;
};

const tabItems: Array<{ key: ViewTab; label: string }> = [
  { key: "outline", label: "Outline" },
  { key: "performance", label: "Past Performance" },
  { key: "personnel", label: "Key Personnel" },
  { key: "documents", label: "Focus Documents" },
];

const initialOutlineRows: OutlineRow[] = [
  { id: "r1", title: "Cover page", type: "Cover page", target: 18, limit: 5, reviewer: "Eddie Lake", tab: "outline" },
  { id: "r2", title: "Table of contents", type: "Table of contents", target: 29, limit: 24, reviewer: "Eddie Lake", tab: "outline" },
  { id: "r3", title: "Executive summary", type: "Narrative", target: 10, limit: 13, reviewer: "Eddie Lake", tab: "outline" },
  { id: "r4", title: "Technical approach", type: "Narrative", target: 27, limit: 23, reviewer: "Jamik Tashpulatov", tab: "performance" },
  { id: "r5", title: "Design", type: "Narrative", target: 2, limit: 16, reviewer: "Jamik Tashpulatov", tab: "performance" },
  { id: "r6", title: "Capabilities", type: "Narrative", target: 20, limit: 8, reviewer: "Jamik Tashpulatov", tab: "personnel" },
  { id: "r7", title: "Integration with existing systems", type: "Narrative", target: 19, limit: 21, reviewer: "", tab: "personnel" },
  { id: "r8", title: "Innovation and Advantages", type: "Narrative", target: 25, limit: 26, reviewer: "", tab: "documents" },
  { id: "r9", title: "Overview of EMR's Innovative Solutions", type: "Technical content", target: 7, limit: 23, reviewer: "", tab: "documents" },
  { id: "r10", title: "Advanced Algorithms and Machine Learning", type: "Narrative", target: 30, limit: 28, reviewer: "", tab: "documents" },
];

function createRowId() {
  return `r${Math.random().toString(36).slice(2, 8)}`;
}

const chartDataByRange: Record<RangeKey, { labels: string[]; upper: number[]; lower: number[] }> = {
  "90d": {
    labels: ["Apr 1", "Apr 8", "Apr 15", "Apr 22", "May 1", "May 8", "May 15", "May 22", "Jun 1", "Jun 8", "Jun 15", "Jun 22", "Jun 30"],
    upper: [36, 62, 43, 59, 79, 48, 71, 55, 86, 57, 92, 64, 80],
    lower: [18, 31, 25, 34, 45, 26, 40, 30, 52, 33, 57, 38, 45],
  },
  "30d": {
    labels: ["Jun 1", "Jun 3", "Jun 5", "Jun 7", "Jun 9", "Jun 11", "Jun 13", "Jun 15", "Jun 17", "Jun 19", "Jun 21", "Jun 23", "Jun 25", "Jun 27", "Jun 30"],
    upper: [42, 87, 34, 64, 90, 28, 88, 56, 98, 38, 86, 97, 43, 95, 79],
    lower: [24, 40, 19, 37, 46, 17, 41, 33, 50, 21, 44, 51, 23, 48, 39],
  },
  "7d": {
    labels: ["Jun 24", "Jun 25", "Jun 26", "Jun 27", "Jun 28", "Jun 29", "Jun 30"],
    upper: [56, 64, 78, 85, 69, 61, 74],
    lower: [29, 35, 41, 47, 40, 36, 42],
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function smoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  return points.reduce((path, point, index, list) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const prev = list[index - 1];
    const controlX = (prev.x + point.x) / 2;

    return `${path} C ${controlX.toFixed(2)} ${prev.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

export default function DashboardPage() {
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);

  const [range, setRange] = useState<RangeKey>("30d");
  const [viewTab, setViewTab] = useState<ViewTab>("outline");
  const [rows, setRows] = useState<OutlineRow[]>(initialOutlineRows);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowKeyword, setRowKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibleColumns, setVisibleColumns] = useState<Record<DashboardColumnKey, boolean>>({
    target: true,
    limit: true,
    reviewer: true,
  });

  const load = useCallback(async () => {
    setStatus("loading");
    const result = await getDashboardOverview();
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }

    setData(result.data);
    setStatus("ready");
  }, []);

  useEffect(() => {
    load().catch((nextError: unknown) => {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    });
  }, [load]);

  const metricCards = useMemo<MetricCardData[]>(() => {
    if (!data) return [];

    const monthlyGrowth = data.kpi.monthlyClasses
      ? ((data.kpi.monthlyConsumedHours / data.kpi.monthlyClasses) * 10).toFixed(1)
      : "0.0";

    return [
      {
        title: "Total Revenue",
        value: formatCurrency(data.kpi.monthlyIncomeYuan),
        delta: "+12.5%",
        trend: "up",
        note: "Trending up this month",
        subNote: "Visitors for the last 6 months",
      },
      {
        title: "New Customers",
        value: formatInteger(data.kpi.monthlyOrders),
        delta: "-20%",
        trend: "down",
        note: "Down 20% this period",
        subNote: "Acquisition needs attention",
      },
      {
        title: "Active Accounts",
        value: formatInteger(data.kpi.activeStudents),
        delta: "+12.5%",
        trend: "up",
        note: "Strong user retention",
        subNote: "Engagement exceed targets",
      },
      {
        title: "Growth Rate",
        value: `${monthlyGrowth}%`,
        delta: `+${monthlyGrowth}%`,
        trend: "up",
        note: "Steady performance",
        subNote: "Meets growth projections",
      },
    ];
  }, [data]);

  const sectionRows = useMemo(() => {
    if (viewTab === "outline") return rows;
    return rows.filter((row) => row.tab === viewTab);
  }, [rows, viewTab]);

  const sectionTypes = useMemo(() => {
    return Array.from(new Set(sectionRows.map((row) => row.type))).sort((left, right) => left.localeCompare(right));
  }, [sectionRows]);

  useEffect(() => {
    if (typeFilter !== "all" && !sectionTypes.includes(typeFilter)) {
      setTypeFilter("all");
    }
  }, [sectionTypes, typeFilter]);

  const visibleRows = useMemo(() => {
    const query = rowKeyword.trim().toLowerCase();
    return sectionRows.filter((row) => {
      const matchesType = typeFilter === "all" || row.type === typeFilter;
      const matchesQuery =
        !query ||
        row.title.toLowerCase().includes(query) ||
        row.reviewer.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [sectionRows, rowKeyword, typeFilter]);

  const tabCountMap = useMemo(() => {
    return {
      outline: rows.length,
      performance: rows.filter((row) => row.tab === "performance").length,
      personnel: rows.filter((row) => row.tab === "personnel").length,
      documents: rows.filter((row) => row.tab === "documents").length,
    } as Record<ViewTab, number>;
  }, [rows]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const selectedInView = visibleRows.filter((row) => selectedIds.includes(row.id)).length;
  const tableColumnCount =
    5 +
    (visibleColumns.target ? 1 : 0) +
    (visibleColumns.limit ? 1 : 0) +
    (visibleColumns.reviewer ? 1 : 0);

  function toggleRowSelection(rowId: string) {
    setSelectedIds((previous) => (previous.includes(rowId) ? previous.filter((id) => id !== rowId) : [...previous, rowId]));
  }

  function toggleSelectAll() {
    const visibleIds = visibleRows.map((row) => row.id);
    if (allSelected) {
      setSelectedIds((previous) => previous.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((previous) => Array.from(new Set([...previous, ...visibleIds])));
  }

  function updateRowNumber(rowId: string, field: "target" | "limit", value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, [field]: parsed } : row)));
  }

  function updateReviewer(rowId: string, reviewer: string) {
    setRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, reviewer } : row)));
  }

  function moveRow(rowId: string, direction: "up" | "down") {
    const visibleIds = visibleRows.map((row) => row.id);
    const currentVisibleIndex = visibleIds.indexOf(rowId);
    if (currentVisibleIndex === -1) return;

    const targetVisibleIndex = direction === "up" ? currentVisibleIndex - 1 : currentVisibleIndex + 1;
    const targetRowId = visibleIds[targetVisibleIndex];
    if (!targetRowId) return;

    setRows((previous) => {
      const index = previous.findIndex((row) => row.id === rowId);
      const nextIndex = previous.findIndex((row) => row.id === targetRowId);
      if (index === -1 || nextIndex === -1) return previous;
      const copied = [...previous];
      [copied[index], copied[nextIndex]] = [copied[nextIndex], copied[index]];
      return copied;
    });
  }

  function toggleColumn(column: DashboardColumnKey) {
    setVisibleColumns((previous) => ({ ...previous, [column]: !previous[column] }));
  }

  function addSection() {
    const nextId = createRowId();
    setRows((previous) => [
      ...previous,
      {
        id: nextId,
        title: `New section ${previous.length + 1}`,
        type: "Narrative",
        target: 10,
        limit: 10,
        reviewer: "",
        tab: viewTab === "outline" ? "outline" : viewTab,
      },
    ]);
    toast.success("新分节已添加");
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="h-8 rounded-md border-border/70 bg-background/70 px-3"
          onClick={() => {
            load().then(() => toast.success("Dashboard refreshed"));
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh data
        </Button>
      </div>

      {status === "loading" ? <LoadingState text="正在加载工作台数据..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load()} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" && data ? (
        <>
          <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
            {metricCards.map((card) => (
              <MetricCard key={card.title} data={card} />
            ))}
          </section>

          <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Total Visitors</h3>
                <p className="text-sm text-muted-foreground">Total for the last 3 months</p>
              </div>
              <div className="hidden items-center overflow-hidden rounded-md border border-border/80 bg-muted/40 p-0.5 sm:flex">
                <RangeButton label="Last 3 months" active={range === "90d"} onClick={() => setRange("90d")} />
                <RangeButton label="Last 30 days" active={range === "30d"} onClick={() => setRange("30d")} />
                <RangeButton label="Last 7 days" active={range === "7d"} onClick={() => setRange("7d")} />
              </div>
              <div className="sm:hidden">
                <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
                  <SelectTrigger className="h-8 w-40 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90d">Last 3 months</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <VisitorsChart labels={chartDataByRange[range].labels} upperSeries={chartDataByRange[range].upper} lowerSeries={chartDataByRange[range].lower} />
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted p-1">
                {tabItems.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={
                      viewTab === tab.key
                        ? "inline-flex h-8 items-center gap-1 rounded-sm bg-background px-3 text-sm font-medium text-foreground shadow-sm"
                        : "inline-flex h-8 items-center gap-1 rounded-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                    }
                    onClick={() => {
                      setViewTab(tab.key);
                      setSelectedIds([]);
                      setTypeFilter("all");
                      setRowKeyword("");
                    }}
                  >
                    {tab.label}
                    {tab.key === "outline" ? null : (
                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                        {tabCountMap[tab.key]}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 rounded-md px-3">
                      <Columns2 className="h-4 w-4" />
                      Customize Columns
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>显示列</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.target}
                      onCheckedChange={() => toggleColumn("target")}
                    >
                      Target
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.limit}
                      onCheckedChange={() => toggleColumn("limit")}
                    >
                      Limit
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.reviewer}
                      onCheckedChange={() => toggleColumn("reviewer")}
                    >
                      Reviewer
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" className="h-8 rounded-md px-3" onClick={addSection}>
                  <Plus className="h-4 w-4" />
                  Add Section
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card p-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={rowKeyword}
                  onChange={(event) => setRowKeyword(event.target.value)}
                  placeholder="Search section title / reviewer"
                  className="h-8 rounded-md border-transparent bg-muted/50 pl-8 shadow-none hover:bg-muted/70 focus-visible:border-border focus-visible:bg-background"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-44 rounded-md">
                  <SelectValue placeholder="Section type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {sectionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="max-h-[30rem] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/80">
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-border"
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      <TableHead>Header</TableHead>
                      <TableHead>Section Type</TableHead>
                      {visibleColumns.target ? <TableHead className="text-right">Target</TableHead> : null}
                      {visibleColumns.limit ? <TableHead className="text-right">Limit</TableHead> : null}
                      {visibleColumns.reviewer ? <TableHead>Reviewer</TableHead> : null}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} className="py-8 text-center text-sm text-muted-foreground">
                          No sections match your current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.map((row, rowIndex) => {
                        const selected = selectedIds.includes(row.id);
                        const isFirst = rowIndex === 0;
                        const isLast = rowIndex === visibleRows.length - 1;
                        return (
                          <TableRow key={row.id} className={selected ? "bg-muted/50" : ""}>
                            <TableCell>
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleRowSelection(row.id)}
                                className="h-4 w-4 rounded border-border"
                                aria-label={`Select ${row.title}`}
                              />
                            </TableCell>
                            <TableCell>
                              <button type="button" className="text-left text-sm font-medium hover:underline">
                                {row.title}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full text-muted-foreground">
                                {row.type}
                              </Badge>
                            </TableCell>
                            {visibleColumns.target ? (
                              <TableCell className="text-right">
                                <Input
                                  value={row.target}
                                  onChange={(event) => updateRowNumber(row.id, "target", event.target.value)}
                                  className="ml-auto h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-muted/60 focus-visible:border-border"
                                  inputMode="numeric"
                                />
                              </TableCell>
                            ) : null}
                            {visibleColumns.limit ? (
                              <TableCell className="text-right">
                                <Input
                                  value={row.limit}
                                  onChange={(event) => updateRowNumber(row.id, "limit", event.target.value)}
                                  className="ml-auto h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-muted/60 focus-visible:border-border"
                                  inputMode="numeric"
                                />
                              </TableCell>
                            ) : null}
                            {visibleColumns.reviewer ? (
                              <TableCell>
                                {row.reviewer ? (
                                  <span className="text-sm">{row.reviewer}</span>
                                ) : (
                                  <Select value={row.reviewer || "unassigned"} onValueChange={(value) => updateReviewer(row.id, value === "unassigned" ? "" : value)}>
                                    <SelectTrigger className="h-8 w-40 rounded-md">
                                      <SelectValue placeholder="Assign reviewer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Assign reviewer</SelectItem>
                                      <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                                      <SelectItem value="Jamik Tashpulatov">Jamik Tashpulatov</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem disabled={isFirst} onClick={() => moveRow(row.id, "up")}>
                                    Move up
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={isLast} onClick={() => moveRow(row.id, "down")}>
                                    Move down
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setRows((previous) => {
                                        const index = previous.findIndex((item) => item.id === row.id);
                                        if (index === -1) return previous;
                                        const copy: OutlineRow = {
                                          ...row,
                                          id: createRowId(),
                                          title: `${row.title} copy`,
                                        };
                                        const next = [...previous];
                                        next.splice(index + 1, 0, copy);
                                        return next;
                                      });
                                      toast.success("已复制分节");
                                    }}
                                  >
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      setRows((previous) => previous.filter((item) => item.id !== row.id));
                                      setSelectedIds((previous) => previous.filter((id) => id !== row.id));
                                      toast.success("已删除分节");
                                    }}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t bg-background px-4 py-2 text-sm text-muted-foreground">
                <span>{selectedInView} of {visibleRows.length} row(s) selected.</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold tracking-tight">Visitors composition</h3>
              <p className="mt-1 text-sm text-muted-foreground">January - June 2024</p>
              <DonutStat />
              <p className="mt-3 flex items-center gap-2 text-sm font-medium">
                Trending up by 5.2% this month
                <TrendingUp className="h-4 w-4" />
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold tracking-tight">Channel mix</h3>
              <p className="mt-1 text-sm text-muted-foreground">January - June 2024</p>
              <div className="mt-4 space-y-3">
                <ChannelBar label="Chrome" value={275} color="bg-[var(--color-chart-1)]" />
                <ChannelBar label="Safari" value={200} color="bg-[var(--color-chart-2)]" />
                <ChannelBar label="Firefox" value={187} color="bg-[var(--color-chart-3)]" />
                <ChannelBar label="Edge" value={173} color="bg-[var(--color-chart-4)]" />
                <ChannelBar label="Other" value={90} color="bg-[var(--color-chart-5)]" />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function RangeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "h-7 rounded-sm bg-background px-2.5 text-xs font-medium" : "h-7 rounded-sm px-2.5 text-xs text-muted-foreground hover:text-foreground"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MetricCard({ data }: { data: MetricCardData }) {
  const isUp = data.trend === "up";

  return (
    <article className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{data.title}</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/45 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {data.delta}
        </span>
      </div>

      <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">{data.value}</p>

      <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {data.note}
        {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{data.subNote}</p>
    </article>
  );
}

function VisitorsChart({
  labels,
  upperSeries,
  lowerSeries,
}: {
  labels: string[];
  upperSeries: number[];
  lowerSeries: number[];
}) {
  const width = 980;
  const height = 320;
  const padding = { top: 18, right: 14, bottom: 50, left: 14 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...upperSeries, ...lowerSeries);
  const baselineY = padding.top + plotHeight;

  const toPoint = (value: number, index: number) => {
    const x = padding.left + (index / (upperSeries.length - 1 || 1)) * plotWidth;
    const y = padding.top + ((maxValue - value) / maxValue) * plotHeight;
    return { x, y };
  };

  const upperPoints = upperSeries.map((value, index) => toPoint(value, index));
  const lowerPoints = lowerSeries.map((value, index) => toPoint(value, index));

  const upperPath = smoothLinePath(upperPoints);
  const lowerPath = smoothLinePath(lowerPoints);

  const upperAreaPath = `${upperPath} L ${upperPoints[upperPoints.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${upperPoints[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  const lowerAreaPath = `${lowerPath} L ${lowerPoints[lowerPoints.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${lowerPoints[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

  const gridLines = Array.from({ length: 5 }, (_, index) => padding.top + (plotHeight / 4) * index);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-2.5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[16rem] min-w-[760px] w-full" role="img" aria-label="Total visitors trend chart">
        <defs>
          <linearGradient id="visitors-main-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="visitors-sub-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {gridLines.map((lineY) => (
          <line
            key={lineY}
            x1={padding.left}
            y1={lineY}
            x2={width - padding.right}
            y2={lineY}
            stroke="var(--color-border)"
            strokeOpacity="0.9"
            strokeWidth="1"
          />
        ))}

        <path d={upperAreaPath} fill="url(#visitors-main-fill)" />
        <path d={lowerAreaPath} fill="url(#visitors-sub-fill)" />

        <path d={upperPath} fill="none" stroke="var(--color-primary)" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
        <path d={lowerPath} fill="none" stroke="var(--color-primary)" strokeOpacity="0.92" strokeWidth="2" strokeLinecap="round" />

        {labels.map((label, index) => {
          const x = padding.left + (index / (labels.length - 1 || 1)) * plotWidth;
          return (
            <text key={label} x={x} y={baselineY + 26} textAnchor="middle" fontSize="12" fill="var(--color-muted-foreground)">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function DonutStat() {
  const total = 1125;
  const segments = [30, 22, 18, 17, 13];
  const colors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  const circles = segments.map((value, index) => ({
    arc: (value / 100) * 360,
    color: colors[index],
  }));

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="relative h-56 w-56">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {circles.map((segment, index) => {
            const length = (segment.arc / 360) * 314;
            const offset = circles.slice(0, index).reduce((sum, item) => sum + (item.arc / 360) * 314, 0);
            return (
              <circle
                key={index}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={`${length} 314`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold tracking-tight">{formatInteger(total)}</p>
          <p className="text-sm text-muted-foreground">Visitors</p>
        </div>
      </div>
    </div>
  );
}

function ChannelBar({ label, value, color }: { label: string; value: number; color: string }) {
  const widthPercent = Math.max(8, Math.min(100, (value / 275) * 100));

  return (
    <div className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2.5 rounded-full bg-muted">
        <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${widthPercent}%` }} />
      </div>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
