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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTeacher, getTeachers, updateTeacher, updateTeacherStatus } from "@/src/services/core-service";
import type { Teacher } from "@/src/types/domain";

const PAGE_SIZE = 10;

type TeacherForm = {
  sourceTeacherId: string;
  name: string;
  phone: string;
  subjectsText: string;
  status: "在职" | "停用";
};

const defaultForm: TeacherForm = {
  sourceTeacherId: "",
  name: "",
  phone: "",
  subjectsText: "",
  status: "在职",
};

function parseSubjects(input: string): string[] {
  return input
    .split(/[，,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function TeachersPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Teacher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "在职" | "停用">("all");
  const [form, setForm] = useState<TeacherForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getTeachers({
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
      setError(e instanceof Error ? e.message : "加载老师列表失败");
    });
  }, [load]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("请填写老师姓名");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sourceTeacherId: form.sourceTeacherId.trim() || undefined,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        subjects: parseSubjects(form.subjectsText),
        status: form.status,
      };
      const result = editingId
        ? await updateTeacher(editingId, payload)
        : await createTeacher(payload);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success(editingId ? "老师信息已更新" : "老师已新增");
      resetForm();
      await load(editingId ? page : 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleTeacherStatus(row: Teacher) {
    try {
      const nextStatus = row.status === "在职" ? "停用" : "在职";
      const result = await updateTeacherStatus(row.id, nextStatus);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success(`老师已${nextStatus === "停用" ? "停用" : "启用"}`);
      await load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新状态失败");
    }
  }

  function handleEdit(row: Teacher) {
    setEditingId(row.id);
    setForm({
      sourceTeacherId: row.id,
      name: row.name,
      phone: row.phone === "-" ? "" : row.phone,
      subjectsText: row.subjects.join(","),
      status: row.status,
    });
  }

  const columns: Array<ColumnDef<Teacher>> = useMemo(
    () => [
      { key: "name", title: "老师姓名" },
      { key: "phone", title: "手机号" },
      { key: "subject", title: "授课科目" },
      {
        key: "status",
        title: "在职状态",
        render: (row) => <Badge variant={row.status === "在职" ? "default" : "secondary"}>{row.status}</Badge>,
      },
      { key: "classCount", title: "当前班级数" },
      { key: "weeklyHours", title: "本周课时" },
      {
        key: "actions",
        title: "操作",
        render: (row) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                handleEdit(row);
              }}
            >
              编辑
            </Button>
            <Button
              size="sm"
              variant={row.status === "在职" ? "destructive" : "default"}
              onClick={(event) => {
                event.stopPropagation();
                void handleToggleTeacherStatus(row);
              }}
            >
              {row.status === "在职" ? "停用" : "启用"}
            </Button>
          </div>
        ),
      },
    ],
    [page],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="老师管理"
        description="管理老师资料、授课状态及排课信息。"
        actions={<Button onClick={resetForm}>新增老师</Button>}
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="老师ID（可选）"
              value={form.sourceTeacherId}
              onChange={(event) => setForm((prev) => ({ ...prev, sourceTeacherId: event.target.value }))}
              disabled={Boolean(editingId)}
            />
            <Input
              placeholder="老师姓名"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="手机号"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Input
              placeholder="授课科目（逗号分隔）"
              value={form.subjectsText}
              onChange={(event) => setForm((prev) => ({ ...prev, subjectsText: event.target.value }))}
            />
            <Select
              value={form.status}
              onValueChange={(value: "在职" | "停用") => setForm((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="在职">在职</SelectItem>
                <SelectItem value="停用">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {editingId ? "保存编辑" : "新增老师"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={resetForm} disabled={submitting}>
                取消编辑
              </Button>
            ) : null}
          </div>
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
        <FilterField label="关键词（姓名/手机号）">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入关键词" />
        </FilterField>
        <FilterField label="在职状态">
          <Select value={statusFilter} onValueChange={(value: "all" | "在职" | "停用") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="在职">在职</SelectItem>
              <SelectItem value="停用">停用</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="老师列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} onRowClick={handleEdit} />
            </CardContent>
          </Card>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}
    </div>
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
