"use client";

import { useCallback, useEffect, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createScheduleEvent, getSchedules } from "@/src/services/core-service";
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
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

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

  const submitCreate = useCallback(async () => {
    setCreateError("");
    setCreateSuccess("");
    if (!className.trim() || !teacherName.trim() || !startTime || !endTime) {
      setCreateError("请填写班级、老师、开始和结束时间。");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setCreateError("时间格式无效，请重新选择。");
      return;
    }
    if (end <= start) {
      setCreateError("结束时间必须晚于开始时间。");
      return;
    }

    setCreating(true);
    try {
      const result = await createScheduleEvent({
        className: className.trim(),
        teacherName: teacherName.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        roomName: roomName.trim() || undefined,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      if (result.kind === "conflict") {
        setCreateError(`排课冲突（SCHEDULE_CONFLICT）：${result.message}`);
        return;
      }
      setCreateSuccess("新建排课成功。");
      setClassName("");
      setTeacherName("");
      setStartTime("");
      setEndTime("");
      setRoomName("");
      await load(1);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "新建排课失败");
    } finally {
      setCreating(false);
    }
  }, [className, teacherName, startTime, endTime, roomName, load]);

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
      <PageHeader title="课表管理" description="计划排课数据源（schedule_events）。" />
      <div className="grid gap-2 md:grid-cols-6">
        <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="班级名称" />
        <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="老师姓名" />
        <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="教室（可选）" />
        <Button onClick={() => void submitCreate()} disabled={creating}>
          {creating ? "创建中..." : "新建排课"}
        </Button>
      </div>
      {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
      {createSuccess ? <p className="text-sm text-green-600">{createSuccess}</p> : null}

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
