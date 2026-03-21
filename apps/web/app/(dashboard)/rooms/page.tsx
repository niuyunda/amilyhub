"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { FilterBar } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { Pager } from "@/components/common/pager";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createRoom, deleteRoom, listRooms, updateRoom } from "@/src/services/core-service";
import type { Room } from "@/src/types/domain";

const PAGE_SIZE = 20;

type RoomFormState = {
  name: string;
  campus: string;
  capacity: string;
  status: string;
};

const DEFAULT_ROOM_FORM: RoomFormState = {
  name: "",
  campus: "",
  capacity: "",
  status: "active",
};

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export default function RoomsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomFormState>(DEFAULT_ROOM_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await listRooms({
      page: nextPage,
      pageSize: PAGE_SIZE,
      q: keyword || undefined,
      campus: campusFilter || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    if (result.kind === "ok") {
      setRows(result.data.items);
      setTotal(result.data.total);
      setPage(result.data.page);
      setStatus("ready");
    }
  }, [keyword, campusFilter, statusFilter]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "教室列表加载失败");
    });
  }, [load]);

  const openCreate = () => {
    setFormMode("create");
    setEditingRoom(null);
    setForm(DEFAULT_ROOM_FORM);
    setFormOpen(true);
  };

  const openEdit = (room: Room) => {
    setFormMode("edit");
    setEditingRoom(room);
    setForm({
      name: room.name,
      campus: room.campus,
      capacity: String(room.capacity),
      status: room.status,
    });
    setFormOpen(true);
  };

  const onSubmit = async () => {
    if (!form.name.trim()) {
      toast.warning("请填写教室名称");
      return;
    }
    const capacity = Math.max(0, Number(form.capacity || "0"));
    try {
      setSubmitting(true);
      if (formMode === "create") {
        const result = await createRoom({
          name: form.name.trim(),
          campus: form.campus.trim() || undefined,
          capacity,
          status: form.status || "active",
        });
        if (result.kind === "forbidden") {
          setStatus("forbidden");
          return;
        }
        toast.success("教室创建成功");
      } else if (editingRoom) {
        const result = await updateRoom(editingRoom.id, {
          name: form.name.trim(),
          campus: form.campus.trim() || undefined,
          capacity,
          status: form.status || undefined,
        });
        if (result.kind === "forbidden") {
          setStatus("forbidden");
          return;
        }
        toast.success("教室信息已更新");
      }
      setFormOpen(false);
      await load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (room: Room) => {
    if (!window.confirm(`确认删除教室：${room.name}？`)) return;
    try {
      const result = await deleteRoom(room.id);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("教室已删除");
      await load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const columns: Array<ColumnDef<Room>> = useMemo(
    () => [
      { key: "name", title: "教室名称" },
      { key: "campus", title: "校区" },
      { key: "capacity", title: "容量（人）" },
      {
        key: "status",
        title: "状态",
        render: (row) => (
          <Badge variant={row.status === "active" ? "default" : "secondary"}>
            {row.status === "active" ? "启用" : "停用"}
          </Badge>
        ),
      },
      {
        key: "actions",
        title: "操作",
        render: (row) => (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>编辑</Button>
            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); void onDelete(row); }}>删除</Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="教室管理"
        description="管理校区教室资源，支持新增、编辑和删除操作。"
        actions={<Button onClick={openCreate}>新增教室</Button>}
      />

      <FilterBar
        onReset={() => {
          setKeyword("");
          setCampusFilter("");
          setStatusFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="关键词（教室名称）">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="请输入教室名称" />
        </FilterField>
        <FilterField label="校区">
          <Input value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} placeholder="校区" />
        </FilterField>
        <FilterField label="状态">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">启用</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="教室列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="p-4">
              <DataTable rows={rows} columns={columns} />
            </CardContent>
          </Card>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "新增教室" : "编辑教室"}</DialogTitle>
            <DialogDescription>填写教室基本信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">教室名称 *</p>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例如：一号教室"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">校区</p>
              <Input
                value={form.campus}
                onChange={(e) => setForm((f) => ({ ...f, campus: e.target.value }))}
                placeholder="例如：总校区"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">容量（人）</p>
              <Input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="教室容量"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">状态</p>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
            <Button disabled={submitting} onClick={() => void onSubmit()}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
