"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
  const [classType, setClassType] = useState<"班课" | "一对一">("班课");

  const load = useCallback(async (nextPage: number, nextType?: "班课" | "一对一") => {
    setStatus("loading");
    const result = await getClasses({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      teacherName: teacherFilter || undefined,
      classType: nextType ?? classType,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }, [keyword, statusFilter, teacherFilter, classType]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载班级列表失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<ClassRoom>> = useMemo(
    () => [
      {
        key: "name",
        title: "班级名称",
        render: (row) => <Link className="text-primary hover:underline" href={`/classes/${encodeURIComponent(row.id)}`}>{row.name}</Link>,
      },
      { key: "courseName", title: "课程" },
      { key: "teacherName", title: "授课老师" },
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
        description="对齐小麦助教：班课/一对一、班级清单、班级详情、排课信息、班级学员、点名情况。"
        actions={
          <div className="inline-flex rounded-lg bg-muted p-1">
            <button className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${classType === "班课" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted-foreground/10"}`} onClick={() => { setClassType("班课"); void load(1, "班课"); }}>班课</button>
            <button className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${classType === "一对一" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted-foreground/10"}`} onClick={() => { setClassType("一对一"); void load(1, "一对一"); }}>一对一</button>
          </div>
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
        <FilterField label="关键词（班级/课程）">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="请输入关键词" />
        </FilterField>
        <FilterField label="授课老师">
          <Input value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} placeholder="老师" />
        </FilterField>
        <FilterField label="开班状态">
          <Select value={statusFilter} onValueChange={(v: "all" | "开班中" | "已结班") => setStatusFilter(v)}>
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
      </FilterBar>

      {status === "loading" ? <LoadingState text="班级列表加载中..." /> : null}
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
