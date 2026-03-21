"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSchedules } from "@/src/services/core-service";
import type { ScheduleItem } from "@/src/types/domain";

const tabs = [
  { key: "time", label: "时间课表" },
  { key: "teacher", label: "老师课表" },
  { key: "room", label: "教室课表" },
  { key: "class", label: "班级课表" },
] as const;

type TabKey = (typeof tabs)[number]["key"];
type ViewMode = "day" | "week";

const WEEK_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateTime(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function slotKey(item: ScheduleItem): string {
  if (item.timeRange && item.timeRange !== "-") return item.timeRange;
  const dt = parseDateTime(item.dateTime);
  if (!dt) return "未知时段";
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function renderTitle(tab: TabKey, item: ScheduleItem): string {
  if (tab === "teacher") return item.teacherName;
  if (tab === "room") return item.roomName;
  if (tab === "class") return item.className;
  return item.className;
}

function statusMeta(status: string): { label: string; cls: string } {
  if (status.includes("已") || status.includes("到")) return { label: status, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (status === "-" || status.includes("未")) return { label: "未点名", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: status, cls: "bg-slate-50 text-slate-700 border-slate-200" };
}

export default function SchedulesPage() {
  const [tab, setTab] = useState<TabKey>("time");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const displayDays = useMemo(() => {
    if (viewMode === "day") return [new Date(anchorDate)];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, anchorDate, weekStart]);

  const load = useCallback(async (nextTab?: TabKey, dateBase?: Date, nextView?: ViewMode) => {
    setStatus("loading");
    const base = dateBase ?? anchorDate;
    const mode = nextView ?? viewMode;
    const days = mode === "day" ? [new Date(base)] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(base), i));

    const results = await Promise.all(
      days.map((d) =>
        getSchedules({
          view: nextTab ?? tab,
          page: 1,
          pageSize: 500,
          keyword: keyword || undefined,
          date: toDateKey(d),
        }),
      ),
    );

    if (results.some((x) => x.kind === "forbidden")) {
      setStatus("forbidden");
      return;
    }

    setRows(results.flatMap((x) => (x.kind === "ok" ? x.data.items : [])));
    setStatus("ready");
  }, [tab, keyword, anchorDate, viewMode]);

  useEffect(() => {
    load().catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  const slots = useMemo(() => Array.from(new Set(rows.map(slotKey))).sort(), [rows]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    for (const item of rows) {
      const dt = parseDateTime(item.dateTime);
      if (!dt) continue;
      const key = `${toDateKey(dt)}|${slotKey(item)}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(item);
    }
    return m;
  }, [rows]);

  const shiftDays = (dir: -1 | 1) => {
    const step = viewMode === "day" ? 1 : 7;
    const d = addDays(anchorDate, dir * step);
    setAnchorDate(d);
    void load(tab, d, viewMode);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">课表管理</h2>
            <p className="text-sm text-muted-foreground">小麦助教风格：日/周课表 + 彩色状态 + 悬浮详情。</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl bg-muted p-1">
              {tabs.map((x) => (
                <button key={x.key} className={`rounded-xl px-4 py-2 text-sm ${tab === x.key ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => { setTab(x.key); void load(x.key, anchorDate, viewMode); }}>{x.label}</button>
              ))}
            </div>
            <div className="inline-flex rounded-2xl bg-muted p-1">
              <button className={`rounded-xl px-3 py-2 text-sm ${viewMode === "day" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => { setViewMode("day"); void load(tab, anchorDate, "day"); }}>日</button>
              <button className={`rounded-xl px-3 py-2 text-sm ${viewMode === "week" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => { setViewMode("week"); void load(tab, anchorDate, "week"); }}>周</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => shiftDays(-1)}>{viewMode === "day" ? "上一天" : "上一周"}</Button>
            <Button variant="outline" onClick={() => { const d = new Date(); setAnchorDate(d); void load(tab, d, viewMode); }}>{viewMode === "day" ? "今天" : "本周"}</Button>
            <Button variant="outline" onClick={() => shiftDays(1)}>{viewMode === "day" ? "下一天" : "下一周"}</Button>
            <Input className="max-w-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/老师/学员" />
            <Button onClick={() => void load(tab, anchorDate, viewMode)}>查询</Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? <LoadingState text="课表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(tab, anchorDate, viewMode)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-28 px-3 py-2 text-left">时间</th>
                {displayDays.map((d, i) => (
                  <th key={i} className="px-3 py-2 text-left">
                    <div>{viewMode === "day" ? "当日" : WEEK_LABELS[i]}</div>
                    <div className="text-xs text-muted-foreground">{toDateKey(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot} className="border-t align-top">
                  <td className="px-3 py-3 font-medium">{slot}</td>
                  {displayDays.map((d, i) => {
                    const key = `${toDateKey(d)}|${slot}`;
                    const cell = cellMap.get(key) ?? [];
                    return (
                      <td key={i} className="px-2 py-2">
                        <div className="space-y-2">
                          {cell.map((item) => {
                            const s = statusMeta(item.status);
                            return (
                              <div key={item.id} className="group rounded-md border p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-xs font-medium">{renderTitle(tab, item)}</p>
                                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${s.cls}`}>{s.label}</span>
                                </div>
                                <p className="truncate text-[11px] text-muted-foreground">{item.studentName}</p>
                                <div className="mt-1 hidden text-[11px] text-muted-foreground group-hover:block">
                                  <p>时间：{item.dateTime}</p>
                                  <p>班级：{item.className}</p>
                                  <p>老师：{item.teacherName}</p>
                                  <p>教室：{item.roomName}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {slots.length === 0 ? (
                <tr><td colSpan={displayDays.length + 1} className="px-3 py-6 text-center text-muted-foreground">当前视图无课表数据</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
