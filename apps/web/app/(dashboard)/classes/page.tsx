"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
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
import { getClasses } from "@/src/services/core-service";
import type { ClassRoom } from "@/src/types/domain";

const PAGE_SIZE = 10;

export default function ClassesPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ClassRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "开班中" | "已结班">("all");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getClasses({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      teacherName: teacherFilter || undefined,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }, [keyword, statusFilter, teacherFilter]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载班级列表失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<ClassRoom>> = useMemo(
    () => [
      { key: "name", title: "班级名称" },
      { key: "courseName", title: "课程" },
      { key: "teacherName", title: "授课老师" },
      { key: "campus", title: "校区" },
      { key: "studentCount", title: "在读人数" },
      { key: "capacity", title: "容量" },
      {
        key: "status",
        title: "开班状态",
        render: (row) => <Badge variant={row.status === "开班中" ? "default" : "secondary"}>{row.status}</Badge>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="班级管理"
        description="管理班级状态、容量与班级成员。"
        actions={
          <>
            <Button onClick={() => toast.success("新建班级（演示）")}>新建班级</Button>
            <Button variant="outline" onClick={() => toast.success("批量调班（演示）")}>
              批量调班
            </Button>
            <Button variant="outline" onClick={() => toast.success("导出班级（演示）")}>
              导出班级
            </Button>
          </>
        }
      />

      <FilterBar
        onReset={() => {
          setKeyword("");
          setTeacherFilter("");
          setStatusFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="关键词（班级/课程/校区）">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入关键词" />
        </FilterField>
        <FilterField label="班级状态">
          <Select value={statusFilter} onValueChange={(value: "all" | "开班中" | "已结班") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="开班中">开班中</SelectItem>
              <SelectItem value="已结班">已结班</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="老师">
          <Input value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} placeholder="老师姓名" />
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="班级列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.success("添加学员（演示）")}>
                  添加学员
                </Button>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  结班
                </Button>
              </div>
            </CardContent>
          </Card>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认结班"
        description="结班后将停止该班级后续排课，属于危险操作。"
        confirmText="确认结班"
        onConfirm={() => toast.success("已执行结班（演示）")}
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
