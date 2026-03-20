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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStudentProfile, getStudents } from "@/src/services/core-service";
import type { Student } from "@/src/types/domain";

const PAGE_SIZE = 10;

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

  const columns: Array<ColumnDef<Student>> = useMemo(
    () => [
      { key: "name", title: "学员姓名" },
      { key: "phone", title: "手机号" },
      { key: "gender", title: "性别" },
      {
        key: "status",
        title: "状态",
        render: (row) => <Badge variant={row.status === "在读" ? "default" : row.status === "停课" ? "secondary" : "outline"}>{row.status}</Badge>,
      },
      { key: "consultant", title: "所属顾问" },
      { key: "latestClassAt", title: "最近上课时间" },
      { key: "remainHours", title: "剩余课时" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="学员管理"
        description="完成学员全生命周期管理，支持筛选、查看、编辑与停课。"
        actions={
          <>
            <Button onClick={() => toast.success("新增学员（演示）")}>新增学员</Button>
            <Button variant="outline" onClick={() => toast.success("导入学员（演示）")}>
              导入学员
            </Button>
            <Button variant="outline" onClick={() => toast.success("导出学员（演示）")}>
              导出学员
            </Button>
          </>
        }
      />

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
        <FilterField label="学员状态">
          <Select value={statusFilter} onValueChange={(value: "all" | "在读" | "停课" | "结课") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="在读">在读</SelectItem>
              <SelectItem value="停课">停课</SelectItem>
              <SelectItem value="结课">结课</SelectItem>
            </SelectContent>
          </Select>
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
                <Button variant="outline" onClick={() => toast.success("批量分班（演示）")}>
                  批量分班
                </Button>
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
              <DetailRow label="所属顾问" value={selected.consultant} />
              <DetailRow label="所属班级" value={selected.className} />
              <DetailRow label="最近上课时间" value={selected.latestClassAt} />
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
                  <p key={idx}>{x.checked_at ? String(x.checked_at).slice(0, 16).replace('T', ' ') : '-'} · {x.course_name} · 消课 {x.consumed_lessons}</p>
                ))}
                {!(selectedProfile?.consumption ?? []).length ? <p className="text-muted-foreground">暂无</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">上课记录</p>
              <div className="max-h-40 space-y-1 overflow-auto rounded border p-2">
                {(selectedProfile?.rollcalls ?? []).slice(0, 10).map((x: any, idx: number) => (
                  <p key={idx}>{x.rollcall_time || '-'} · {x.class_name} · {x.status || '-'}</p>
                ))}
                {!(selectedProfile?.rollcalls ?? []).length ? <p className="text-muted-foreground">暂无</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </DetailSheet>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认停课"
        description="停课属于危险操作，确认后该学员将无法继续正常排课。"
        confirmText="确认停课"
        onConfirm={() => {
          toast.success("已执行停课（演示）");
        }}
      />
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
