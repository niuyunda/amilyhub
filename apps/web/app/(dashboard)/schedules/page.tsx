"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { Pager } from "@/components/common/pager";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSchedules } from "@/src/services/core-service";
import type { ScheduleItem } from "@/src/types/domain";

const PAGE_SIZE = 20;

const tabs = [
  { key: "time", label: "时间课表" },
  { key: "teacher", label: "老师课表" },
  { key: "room", label: "教室课表" },
  { key: "class", label: "班级课表" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function SchedulesPage() {
  const [tab, setTab] = useState<TabKey>("time");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");

  const load = useCallback(async (nextPage: number, nextTab?: TabKey) => {
    setStatus("loading");
    const r = await getSchedules({
      view: nextTab ?? tab,
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      date: date || undefined,
    });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [tab, keyword, date]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  const columns = useMemo<Array<ColumnDef<ScheduleItem>>>(() => {
    const firstTitle = tab === "time" ? "时间段" : tab === "teacher" ? "老师" : tab === "room" ? "教室" : "班级";
    return [
      { key: "viewKey", title: firstTitle },
      { key: "dateTime", title: "上课时间" },
      { key: "className", title: "班级" },
      { key: "teacherName", title: "老师" },
      { key: "roomName", title: "教室" },
      { key: "studentName", title: "学员" },
      { key: "status", title: "点名状态" },
    ];
  }, [tab]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">课表管理</h2>
            <p className="text-sm text-muted-foreground">对齐小麦助教：时间课表、老师课表、教室课表、班级课表。</p>
          </div>

          <div className="inline-flex rounded-2xl bg-muted p-1">
            {tabs.map((x) => (
              <button
                key={x.key}
                className={`rounded-xl px-4 py-2 text-sm ${tab === x.key ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => {
                  setTab(x.key);
                  void load(1, x.key);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Input className="max-w-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/老师/学员" />
            <Input type="date" className="max-w-44" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button onClick={() => void load(1)}>查询</Button>
            <Button variant="outline" onClick={() => { setKeyword(""); setDate(""); void load(1); }}>重置</Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? <LoadingState text="课表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <DataTable rows={rows} columns={columns} />
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}
    </div>
  );
}
