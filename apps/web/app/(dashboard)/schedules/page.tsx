"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createScheduleEvent, deleteScheduleEvent, getSchedules, updateScheduleEvent } from "@/src/services/core-service";
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
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleItem | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [editStatus, setEditStatus] = useState("scheduled");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<ScheduleItem | null>(null);

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

  const openEditDialog = (event: ScheduleItem) => {
    setEditingEvent(event);
    setEditClassName(event.className === "-" ? "" : event.className);
    setEditTeacherName(event.teacherName === "-" ? "" : event.teacherName);
    // Parse datetime string back to datetime-local format
    const dt = event.dateTime.replace(" ", "T").slice(0, 16);
    setEditStartTime(dt);
    setEditEndTime(dt); // approximate; backend returns only dateTime + timeRange
    setEditRoomName(event.roomName === "-" ? "" : event.roomName);
    setEditStatus(event.status === "-" ? "scheduled" : event.status);
    setEditError("");
    setEditOpen(true);
  };

  const openDeleteDialog = (event: ScheduleItem) => {
    setDeletingEvent(event);
    setDeleteConfirmOpen(true);
  };

  const submitEdit = useCallback(async () => {
    if (!editingEvent) return;
    setEditError("");
    if (!editClassName.trim() || !editTeacherName.trim() || !editStartTime || !editEndTime) {
      setEditError("请填写班级、老师、开始和结束时间。");
      return;
    }
    const start = new Date(editStartTime);
    const end = new Date(editEndTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setEditError("结束时间必须晚于开始时间。");
      return;
    }
    setEditSubmitting(true);
    try {
      const result = await updateScheduleEvent(Number(editingEvent.id), {
        className: editClassName.trim(),
        teacherName: editTeacherName.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        roomName: editRoomName.trim() || undefined,
        status: editStatus,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("排课已更新");
      setEditOpen(false);
      await load(1);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setEditSubmitting(false);
    }
  }, [editingEvent, editClassName, editTeacherName, editStartTime, editEndTime, editRoomName, editStatus, load]);

  const submitDelete = useCallback(async () => {
    if (!deletingEvent) return;
    try {
      const result = await deleteScheduleEvent(Number(deletingEvent.id));
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("排课已删除");
      setDeleteConfirmOpen(false);
      await load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }, [deletingEvent, load]);

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
    {
      key: "actions",
      title: "操作",
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditDialog(row); }}>编辑</Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(row); }}>删除</Button>
        </div>
      ),
    },
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑排课</DialogTitle>
            <DialogDescription>修改选中的排课记录。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} placeholder="班级名称" />
            <Input value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} placeholder="老师姓名" />
            <Input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
            <Input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
            <Input value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} placeholder="教室（可选）" />
          </div>
          {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>{editSubmitting ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除这条排课记录吗？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => void submitDelete()}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
