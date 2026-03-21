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
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function renderTitle(tab: TabKey, item: ScheduleItem): string {
  if (tab === "teacher") return `${item.teacherName} · ${item.className}`;
  if (tab === "room") return `${item.roomName} · ${item.className}`;
  if (tab === "class") return `${item.className} · ${item.teacherName}`;
  return `${item.className} · ${item.teacherName}`;
}

export default function SchedulesPage() {
  const [tab, setTab] = useState<TabKey>("time");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async (nextTab?: TabKey, dateBase?: Date) => {
    setStatus("loading");
    const base = dateBase ?? anchorDate;
    const monday = startOfWeek(base);

    const weekResults = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = toDateKey(addDays(monday, i));
        return getSchedules({
          view: nextTab ?? tab,
          page: 1,
          pageSize: 500,
          keyword: keyword || undefined,
          date: day,
        });
      }),
    );

    if (weekResults.some((x) => x.kind === "forbidden")) {
      setStatus("forbidden");
      return;
    }

    const merged = weekResults.flatMap((x) => (x.kind === "ok" ? x.data.items : []));
    setRows(merged);
    setStatus("ready");
  }, [tab, keyword, anchorDate]);

  useEffect(() => {
    load().catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  const slots = useMemo(() => {
    const set = new Set(rows.map(slotKey));
    return Array.from(set).sort();
  }, [rows]);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">课表管理</h2>
            <p className="text-sm text-muted-foreground">按小麦助教样式改为周视图日历课表（时间/老师/教室/班级）。</p>
          </div>

          <div className="inline-flex rounded-2xl bg-muted p-1">
            {tabs.map((x) => (
              <button
                key={x.key}
                className={`rounded-xl px-4 py-2 text-sm ${tab === x.key ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => {
                  setTab(x.key);
                  void load(x.key, anchorDate);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { const d = addDays(anchorDate, -7); setAnchorDate(d); void load(tab, d); }}>上一周</Button>
            <Button variant="outline" onClick={() => { const d = new Date(); setAnchorDate(d); void load(tab, d); }}>本周</Button>
            <Button variant="outline" onClick={() => { const d = addDays(anchorDate, 7); setAnchorDate(d); void load(tab, d); }}>下一周</Button>
            <Input className="max-w-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/老师/学员" />
            <Button onClick={() => void load(tab, anchorDate)}>查询</Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? <LoadingState text="课表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(tab, anchorDate)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="w-32 px-3 py-2 text-left">时间</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="px-3 py-2 text-left">
                    <div>{WEEK_LABELS[i]}</div>
                    <div className="text-xs text-muted-foreground">{toDateKey(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot} className="border-t align-top">
                  <td className="px-3 py-3 font-medium">{slot}</td>
                  {weekDays.map((d, i) => {
                    const key = `${toDateKey(d)}|${slot}`;
                    const cell = cellMap.get(key) ?? [];
                    return (
                      <td key={i} className="px-2 py-2">
                        <div className="space-y-2">
                          {cell.map((item) => (
                            <div key={item.id} className="rounded-md border bg-muted/20 p-2">
                              <p className="text-xs font-medium">{renderTitle(tab, item)}</p>
                              <p className="text-xs text-muted-foreground">学员：{item.studentName}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {slots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">本周无课表数据</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
