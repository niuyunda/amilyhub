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
import { getTeachers } from "@/src/services/core-service";
import type { Teacher } from "@/src/types/domain";

const PAGE_SIZE = 10;

export default function TeachersPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Teacher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "在职" | "停用">("all");

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
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="老师管理"
        description="管理老师资料、授课状态及排课信息。"
        actions={
          <>
            <Button onClick={() => toast.success("新增老师（演示）")}>新增老师</Button>
            <Button variant="outline" onClick={() => toast.success("导出老师（演示）")}>
              导出老师
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
              <DataTable rows={rows} columns={columns} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.success("排课（演示）")}>
                  排课
                </Button>
                <Button variant="destructive" onClick={() => toast.success("停用（演示）")}>
                  停用
                </Button>
              </div>
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
