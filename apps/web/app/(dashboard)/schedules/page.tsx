"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { confirmRollcall, createScheduleEvent, deleteScheduleEvent, getSchedules, updateScheduleEvent } from "@/src/services/core-service";
import type { ScheduleItem } from "@/src/types/domain";

const PAGE_SIZE = 50;

// Group items by date for calendar view
function groupByDate(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const date = item.dateTime ? item.dateTime.split(" ")[0] : "未知日期";
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(item);
  }
  return map;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["正常", "已到", "出勤"].includes(status)) return "default";
  if (["请假"].includes(status)) return "secondary";
  if (["旷课", "缺勤"].includes(status)) return "destructive";
  return "outline";
}

export default function SchedulesPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [date, setDate] = useState("");
  const [view, setView] = useState<"time" | "teacher" | "room" | "class">("time");

  // Create schedule form
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Edit schedule form
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

  // Rollcall confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState<ScheduleItem | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<"正常" | "请假" | "旷课">("正常");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // Delete dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<ScheduleItem | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const r = await getSchedules({ view, page: nextPage, pageSize: PAGE_SIZE, keyword: keyword || undefined, date: date || undefined });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [view, keyword, date]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  const grouped = useMemo(() => groupByDate(rows), [rows]);
  const dates = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

  const openEditDialog = (event: ScheduleItem) => {
    setEditingEvent(event);
    setEditClassName(event.className === "-" ? "" : event.className);
    setEditTeacherName(event.teacherName === "-" ? "" : event.teacherName);
    const dt = event.dateTime ? event.dateTime.replace(" ", "T").slice(0, 16) : "";
    setEditStartTime(dt);
    setEditEndTime(dt);
    setEditRoomName(event.roomName === "-" ? "" : event.roomName);
    setEditStatus(event.status === "-" ? "scheduled" : event.status);
    setEditError("");
    setEditOpen(true);
  };

  const openConfirmDialog = (item: ScheduleItem) => {
    setConfirmingItem(item);
    // Try to infer status from existing status field
    if (["正常", "已到", "出勤"].includes(item.status)) setConfirmStatus("正常");
    else if (["请假"].includes(item.status)) setConfirmStatus("请假");
    else if (["旷课", "缺勤"].includes(item.status)) setConfirmStatus("旷课");
    else setConfirmStatus("正常");
    setConfirmOpen(true);
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
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success("排课已更新");
      setEditOpen(false);
      await load(1);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setEditSubmitting(false);
    }
  }, [editingEvent, editClassName, editTeacherName, editStartTime, editEndTime, editRoomName, editStatus, load]);

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
      setCreateError("时间格式无效。");
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
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      if (result.kind === "conflict") {
        setCreateError(`排课冲突：${result.message}`);
        return;
      }
      toast.success("新建排课成功");
      setClassName(""); setTeacherName(""); setStartTime(""); setEndTime(""); setRoomName("");
      setCreateSuccess("");
      await load(1);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "新建排课失败");
    } finally {
      setCreating(false);
    }
  }, [className, teacherName, startTime, endTime, roomName, load]);

  const submitConfirm = useCallback(async () => {
    if (!confirmingItem) return;
    setConfirmSubmitting(true);
    try {
      const result = await confirmRollcall(confirmingItem.id, {
        status: confirmStatus,
        operator: "web-user",
      });
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success(`已确认为【${confirmStatus}】`);
      setConfirmOpen(false);
      await load(page);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "确认失败");
    } finally {
      setConfirmSubmitting(false);
    }
  }, [confirmingItem, confirmStatus, load, page]);

  const submitDelete = useCallback(async () => {
    if (!deletingEvent) return;
    try {
      const result = await deleteScheduleEvent(Number(deletingEvent.id));
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success("排课已删除");
      setDeleteConfirmOpen(false);
      await load(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }, [deletingEvent, load]);

  const columns: Array<ColumnDef<ScheduleItem>> = [
    { key: "dateTime", title: "上课时间" },
    { key: "timeRange", title: "时段" },
    { key: "className", title: "班级" },
    { key: "teacherName", title: "老师" },
    { key: "roomName", title: "教室" },
    { key: "studentName", title: "学员" },
    {
      key: "status", title: "状态",
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: "actions", title: "操作",
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openConfirmDialog(row); }}>确认</Button>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditDialog(row); }}>编辑</Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); openDeleteDialog(row); }}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="课表管理"
        description="小麦上课记录（按天分组），选择日期或搜索班级/老师查看。"
      />

      {/* Create schedule form */}
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-44" />
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/老师/学员" className="max-w-sm" />
        <select
          className="border rounded px-2 py-1 text-sm"
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
        >
          <option value="time">按时间</option>
          <option value="teacher">按老师</option>
          <option value="room">按教室</option>
          <option value="class">按班级</option>
        </select>
        <Button onClick={() => void load(1)}>查询</Button>
      </div>

      {/* Calendar-style grouped view */}
      {status === "loading" ? <LoadingState text="课表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" && rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>暂无课表数据</p>
          <p className="text-sm mt-1">请检查小麦助教的排课数据是否已同步</p>
        </div>
      ) : null}

      {status === "ready" && rows.length > 0 ? (
        <>
          {/* Calendar grouped view */}
          <div className="space-y-6">
            {dates.map((dateStr) => {
              const dayItems = grouped.get(dateStr) ?? [];
              return (
                <div key={dateStr} className="space-y-2">
                  <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b py-1">
                    <h3 className="font-semibold text-base">{dateStr}</h3>
                  </div>
                  <div className="grid gap-2">
                    {dayItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="min-w-[60px] text-sm text-muted-foreground">{item.timeRange}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-2 items-center flex-wrap">
                            <span className="font-medium">{item.className}</span>
                            <span className="text-muted-foreground">·</span>
                            <span>{item.teacherName}</span>
                            {item.roomName && item.roomName !== "-" ? (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground">{item.roomName}</span>
                              </>
                            ) : null}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">{item.studentName}</div>
                        </div>
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openConfirmDialog(item)}>确认</Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>编辑</Button>
                          <Button size="sm" variant="destructive" onClick={() => openDeleteDialog(item)}>删除</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      {/* Edit dialog */}
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

      {/* Rollcall confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上课确认</DialogTitle>
            <DialogDescription>
              确认学员 {confirmingItem?.studentName} 的出勤状态
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">班级：</span>{confirmingItem?.className}</p>
              <p><span className="text-muted-foreground">老师：</span>{confirmingItem?.teacherName}</p>
              <p><span className="text-muted-foreground">时间：</span>{confirmingItem?.dateTime} {confirmingItem?.timeRange}</p>
            </div>
            <div className="flex gap-2">
              {(["正常", "请假", "旷课"] as const).map((s) => (
                <Button
                  key={s}
                  variant={confirmStatus === s ? "default" : "outline"}
                  onClick={() => setConfirmStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button onClick={() => void submitConfirm()} disabled={confirmSubmitting}>
              {confirmSubmitting ? "确认中..." : `确认${confirmStatus}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
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
    </div>
  );
}
