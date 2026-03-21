"use client";

import { useCallback, useEffect, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSchedules } from "@/src/services/core-service";
import type { ScheduleItem } from "@/src/types/domain";

const PAGE_SIZE = 20;

export default function SchedulesPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const r = await getSchedules({ view: "time", page: nextPage, pageSize: PAGE_SIZE, keyword: keyword || undefined, date });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [keyword, date]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<ScheduleItem>> = [
    { key: "dateTime", title: "时间" },
    { key: "timeRange", title: "时段" },
    { key: "className", title: "班级" },
    { key: "teacherName", title: "老师" },
    { key: "roomName", title: "教室" },
    { key: "status", title: "状态" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="课表管理" description="与上课记录统一数据源（rollcalls）。" />
      <div className="flex gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-44" />
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/老师" className="max-w-sm" />
        <Button onClick={() => void load(1)}>查询</Button>
      </div>

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
