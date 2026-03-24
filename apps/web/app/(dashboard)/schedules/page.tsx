"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { confirmRollcall, createScheduleEvent, deleteScheduleEvent, getSchedules, updateScheduleEvent } from "@/src/services/core-service";
import type { ScheduleItem } from "@/src/types/domain";

const PAGE_SIZE = 100;

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${fmt(start)} - ${fmt(end)}`;
}

const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// ─── Status ───────────────────────────────────────────────────────────────────

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["正常", "已到", "出勤", "课消"].includes(status)) return "default";
  if (["请假"].includes(status)) return "secondary";
  if (["旷课", "缺勤"].includes(status)) return "destructive";
  return "outline";
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  // Build 7 date strings for the week
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return toDateStr(d);
    });
  }, [weekStart]);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    // Load all items for the week (fetch enough pages to cover 7 days)
    const r = await getSchedules({ view: "time", page: nextPage, pageSize: PAGE_SIZE, keyword: keyword || undefined });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [keyword]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课表加载失败");
    });
  }, [load]);

  // Filter rows to only this week
  const weekRows = useMemo(() => {
    return rows.filter((item) => {
      const itemDate = item.dateTime ? item.dateTime.split(" ")[0] : "";
      return weekDates.includes(itemDate);
    });
  }, [rows, weekDates]);

  // Unique time slots for this week, sorted
  const timeSlots = useMemo(() => {
    const slots = [...new Set(weekRows.map((r) => r.timeRange))].filter(Boolean);
    // Sort: morning slots first, then afternoon, then evening
    return slots.sort((a, b) => {
      const am = !a.includes("下午") && !a.includes("晚上");
      const bm = !b.includes("下午") && !b.includes("晚上");
      if (am !== bm) return am ? -1 : 1;
      return a.localeCompare(b, "zh-CN", { numeric: true });
    });
  }, [weekRows]);

  // Build grid: map (dayIndex, slot) -> item[]
  const grid = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of weekRows) {
      const dayIndex = weekDates.indexOf(item.dateTime.split(" ")[0]);
      if (dayIndex < 0) continue;
      const key = `${dayIndex}::${item.timeRange}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [weekRows, weekDates]);

  // ─── Dialogs (same as original) ─────────────────────────────────────────

  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleItem | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [editStatus, setEditStatus] = useState("正常");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState<ScheduleItem | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<"正常" | "请假" | "旷课">("正常");
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<ScheduleItem | null>(null);

  const openEditDialog = (event: ScheduleItem) => {
    setEditingEvent(event);
    setEditClassName(event.className === "-" ? "" : event.className);
    setEditTeacherName(event.teacherName === "-" ? "" : event.teacherName);
    const dt = event.dateTime ? event.dateTime.replace(" ", "T").slice(0, 16) : "";
    setEditStartTime(dt);
    setEditEndTime(dt);
    setEditRoomName(event.roomName === "-" ? "" : event.roomName);
    setEditStatus(event.status === "-" ? "正常" : event.status);
    setEditError("");
    setEditOpen(true);
  };

  const openConfirmDialog = (item: ScheduleItem) => {
    setConfirmingItem(item);
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
      await updateScheduleEvent(Number(editingEvent.id), {
        className: editClassName.trim(),
        teacherName: editTeacherName.trim(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        roomName: editRoomName.trim() || undefined,
        status: editStatus,
      });
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
      if (result.kind === "conflict") {
        setCreateError(`排课冲突：${result.message}`);
        return;
      }
      toast.success("新建排课成功");
      setClassName(""); setTeacherName(""); setStartTime(""); setEndTime(""); setRoomName("");
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
      await confirmRollcall(confirmingItem.id, { status: confirmStatus, operator: "web-user" });
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
      await deleteScheduleEvent(Number(deletingEvent.id));
      toast.success("排课已删除");
      setDeleteConfirmOpen(false);
      await load(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }, [deletingEvent, load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="课表管理"
        description="按课程表形式展示，按周浏览，支持上一周/下一周切换。"
      />

      {/* Week navigation + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>上一周</Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>下一周</Button>
          <Button variant="ghost" size="sm" onClick={() => { setWeekOffset(0); void load(1); }}>本周</Button>
        </div>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索班级/老师/学员"
          className="max-w-sm"
        />
        <Button onClick={() => void load(1)}>查询</Button>
        <Button variant="outline" onClick={() => { setKeyword(""); void load(1); }}>重置</Button>
      </div>

      {/* Create form */}
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

      {/* Calendar grid */}
      {status === "loading" ? <LoadingState text="课表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          {weekRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <p>本周暂无课表数据</p>
              <p className="text-sm mt-1">请检查排课数据或切换其他周查看</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-24 px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10">时段</th>
                    {weekDates.map((dateStr, i) => (
                      <th key={dateStr} className="px-2 py-2 text-center font-medium min-w-[100px]">
                        <div>{DAY_NAMES[i]}</div>
                        <div className="text-xs text-muted-foreground font-normal">{dateStr.slice(5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((slot) => (
                    <tr key={slot} className="border-t">
                      <td className="px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-background z-10 whitespace-nowrap">{slot}</td>
                      {weekDates.map((dateStr, dayIndex) => {
                        const items = grid.get(`${dayIndex}::${slot}`) ?? [];
                        return (
                          <td key={dateStr} className="px-1 py-1 vertical-align-top min-w-[100px]">
                            <div className="space-y-1">
                              {items.map((item) => (
                                <div key={item.id} className="border rounded p-1.5 bg-background hover:bg-muted/50 transition-colors text-xs">
                                  <div className="font-medium leading-tight">{item.className}</div>
                                  <div className="text-muted-foreground leading-tight">{item.teacherName}</div>
                                  {item.roomName && item.roomName !== "-" ? (
                                    <div className="text-muted-foreground leading-tight">{item.roomName}</div>
                                  ) : null}
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <Badge variant={statusVariant(item.status)} className="text-[10px] px-1 py-0">{item.status}</Badge>
                                    <div className="flex gap-0.5 ml-auto">
                                      <button
                                        onClick={() => openConfirmDialog(item)}
                                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                        title="确认"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => openEditDialog(item)}
                                        className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                        title="编辑"
                                      >
                                        ✎
                                      </button>
                                      <button
                                        onClick={() => openDeleteDialog(item)}
                                        className="text-muted-foreground hover:text-red-500 p-0.5 rounded"
                                        title="删除"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PAGE_SIZE && (
            <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
          )}
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
            <DialogDescription>确认学员 {confirmingItem?.studentName} 的出勤状态</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">班级：</span>{confirmingItem?.className}</p>
              <p><span className="text-muted-foreground">老师：</span>{confirmingItem?.teacherName}</p>
              <p><span className="text-muted-foreground">时间：</span>{confirmingItem?.dateTime} {confirmingItem?.timeRange}</p>
            </div>
            <div className="flex gap-2">
              {(["正常", "请假", "旷课"] as const).map((s) => (
                <Button key={s} variant={confirmStatus === s ? "default" : "outline"} onClick={() => setConfirmStatus(s)}>{s}</Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button onClick={() => void submitConfirm()} disabled={confirmSubmitting}>{confirmSubmitting ? "确认中..." : `确认${confirmStatus}`}</Button>
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
