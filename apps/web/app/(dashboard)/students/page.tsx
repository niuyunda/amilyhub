"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { DetailSheet } from "@/components/common/detail-sheet";
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
import { createStudent, getStudentProfile, getStudents, updateStudent } from "@/src/services/core-service";
import type { Student } from "@/src/types/domain";

const PAGE_SIZE = 10;

type StudentFormState = {
  sourceStudentId: string;
  name: string;
  phone: string;
  gender: "男" | "女";
  birthday: string;
  status: "在读" | "停课" | "结课";
};

const DEFAULT_FORM: StudentFormState = {
  sourceStudentId: "",
  name: "",
  phone: "",
  gender: "男",
  birthday: "",
  status: "在读",
};

export default function StudentsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "在读" | "停课" | "结课">("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<StudentFormState>(DEFAULT_FORM);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getStudents({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }, [keyword, statusFilter]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载学员列表失败");
    });
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setSelectedProfile(null);
      return;
    }
    getStudentProfile(selected.id)
      .then((res) => {
        if (res.kind === "ok") setSelectedProfile(res.data);
      })
      .catch(() => setSelectedProfile(null));
  }, [selected]);

  const statusStats = useMemo(() => {
    const stats = { all: total, active: 0, suspended: 0, ended: 0 };
    for (const r of rows) {
      if (r.status === "在读") stats.active += 1;
      if (r.status === "停课") stats.suspended += 1;
      if (r.status === "结课") stats.ended += 1;
    }
    return stats;
  }, [rows, total]);

  const columns: Array<ColumnDef<Student>> = useMemo(
    () => [
      { key: "name", title: "学员姓名" },
      { key: "phone", title: "手机号" },
      { key: "className", title: "所在班级" },
      { key: "age", title: "年龄", render: (row) => row.age ?? "-" },
      { key: "birthday", title: "出生日期" },
      {
        key: "status",
        title: "状态",
        render: (row) => <Badge variant={row.status === "在读" ? "default" : row.status === "停课" ? "secondary" : "outline"}>{row.status}</Badge>,
      },
      { key: "consultant", title: "跟进人" },
      { key: "creator", title: "创建人" },
      { key: "createdAt", title: "创建时间" },
    ],
    [],
  );

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setCreateOpen(true);
  };

  const openEdit = () => {
    if (!selected) {
      toast.warning("请先点击一行学员");
      return;
    }
    setForm({
      sourceStudentId: selected.id,
      name: selected.name,
      phone: selected.phone === "-" ? "" : selected.phone,
      gender: selected.gender,
      birthday: selected.birthday === "-" ? "" : selected.birthday,
      status: selected.status,
    });
    setEditOpen(true);
  };

  const onCreate = async () => {
    if (!form.sourceStudentId.trim() || !form.name.trim()) {
      toast.warning("请填写学员ID和姓名");
      return;
    }
    try {
      setSubmitting(true);
      const result = await createStudent({
        sourceStudentId: form.sourceStudentId.trim(),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        gender: form.gender,
        birthday: form.birthday || undefined,
        status: form.status,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("学员创建成功");
      setCreateOpen(false);
      await load(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      const result = await updateStudent(selected.id, {
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        gender: form.gender,
        birthday: form.birthday || undefined,
        status: form.status,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("学员信息已更新");
      setEditOpen(false);
      await load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onSuspend = async () => {
    if (!selected) return;
    try {
      const result = await updateStudent(selected.id, { status: "停课" });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success(`已停课：${selected.name}`);
      await load(page);
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停课失败");
    }
  };

  const exportCsv = () => {
    const header = ["学员ID", "学员姓名", "手机号", "状态", "所在班级", "年龄", "创建时间"];
    const lines = rows.map((r) => [r.id, r.name, r.phone, r.status, r.className, r.age ?? "", r.createdAt]);
    const csv = [header, ...lines]
      .map((line) => line.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("当前页学员已导出 CSV");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="学员管理"
        description="对齐小麦助教核心流程：查询筛选、详情查看、新增编辑、停课与导出。"
        actions={
          <>
            <Button onClick={openCreate}>新增学员</Button>
            <Button variant="outline" onClick={openEdit}>编辑学员</Button>
            <Button variant="outline" onClick={exportCsv}>导出</Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4 text-sm">
          <Button variant={statusFilter === "all" ? "default" : "outline"} onClick={() => { setStatusFilter("all"); void load(1); }}>全部学员（{statusStats.all}）</Button>
          <Button variant={statusFilter === "在读" ? "default" : "outline"} onClick={() => { setStatusFilter("在读"); void load(1); }}>在读学员（{statusStats.active}）</Button>
          <Button variant={statusFilter === "停课" ? "default" : "outline"} onClick={() => { setStatusFilter("停课"); void load(1); }}>停课学员（{statusStats.suspended}）</Button>
          <Button variant={statusFilter === "结课" ? "default" : "outline"} onClick={() => { setStatusFilter("结课"); void load(1); }}>结课学员（{statusStats.ended}）</Button>
        </CardContent>
      </Card>

      <FilterBar
        onReset={() => {
          setKeyword("");
          setStatusFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="搜索学员">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入学员姓名/手机号" />
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="学员列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} onRowClick={(row) => setSelected(row)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!selected) {
                      toast.warning("请先点击一行学员");
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  停课
                </Button>
              </div>
            </CardContent>
          </Card>

          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <DetailSheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={selected ? `${selected.name} - 学员详情` : "学员详情"}>
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2">
              <DetailRow label="学员姓名" value={selected.name} />
              <DetailRow label="手机号" value={selected.phone} />
              <DetailRow label="状态" value={selected.status} />
              <DetailRow label="所在班级" value={selected.className} />
              <DetailRow label="年龄" value={selected.age ? String(selected.age) : "-"} />
              <DetailRow label="出生日期" value={selected.birthday} />
              <DetailRow label="跟进人" value={selected.consultant} />
              <DetailRow label="创建时间" value={selected.createdAt} />
              <DetailRow label="剩余课时" value={`${selected.remainHours}`} />
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">报读课程</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border p-2">
                {(selectedProfile?.courses ?? []).slice(0, 10).map((x: any, idx: number) => (
                  <p key={idx}>{x.course_name} · {x.order_state} · {x.order_no}</p>
                ))}
                {!(selectedProfile?.courses ?? []).length ? <p className="text-muted-foreground">暂无</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">消费记录</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border p-2">
                {(selectedProfile?.consumption ?? []).slice(0, 10).map((x: any, idx: number) => (
                  <p key={idx}>{x.checked_at ? String(x.checked_at).slice(0, 16).replace("T", " ") : "-"} · {x.course_name} · 消课 {x.consumed_lessons}</p>
                ))}
                {!(selectedProfile?.consumption ?? []).length ? <p className="text-muted-foreground">暂无</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </DetailSheet>

      <StudentFormDialog
        title="新增学员"
        description="创建一条可在学员管理中立即检索与维护的学员记录。"
        open={createOpen}
        submitting={submitting}
        form={form}
        onOpenChange={setCreateOpen}
        onFormChange={setForm}
        onSubmit={onCreate}
      />

      <StudentFormDialog
        title="编辑学员"
        description="更新学员基础资料与状态，和小麦助教主流程一致。"
        open={editOpen}
        submitting={submitting}
        form={form}
        onOpenChange={setEditOpen}
        onFormChange={setForm}
        onSubmit={onEdit}
      />

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认停课"
        description="停课后该学员将从在读学员中移除。"
        confirmText="确认停课"
        onConfirm={() => { void onSuspend(); }}
      />
    </div>
  );
}

function StudentFormDialog({
  title,
  description,
  open,
  submitting,
  form,
  onOpenChange,
  onFormChange,
  onSubmit,
}: {
  title: string;
  description: string;
  open: boolean;
  submitting: boolean;
  form: StudentFormState;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: StudentFormState) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Input
            placeholder="学员ID（source_student_id）"
            value={form.sourceStudentId}
            disabled={title === "编辑学员"}
            onChange={(e) => onFormChange({ ...form, sourceStudentId: e.target.value })}
          />
          <Input placeholder="姓名" value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} />
          <Input placeholder="手机号" value={form.phone} onChange={(e) => onFormChange({ ...form, phone: e.target.value })} />
          <Input type="date" value={form.birthday} onChange={(e) => onFormChange({ ...form, birthday: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.gender} onValueChange={(value: "男" | "女") => onFormChange({ ...form, gender: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="男">男</SelectItem>
                <SelectItem value="女">女</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(value: "在读" | "停课" | "结课") => onFormChange({ ...form, status: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="在读">在读</SelectItem>
                <SelectItem value="停课">停课</SelectItem>
                <SelectItem value="结课">结课</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={submitting} onClick={onSubmit}>{submitting ? "提交中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
