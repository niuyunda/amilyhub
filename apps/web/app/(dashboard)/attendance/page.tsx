"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { Pager } from "@/components/common/pager";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAttendance } from "@/src/services/core-service";
import type { AttendanceRecord } from "@/src/types/domain";

const PAGE_SIZE = 10;

function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status.includes("到") || status.includes("已")) return "default";
  if (status.includes("未") || status === "-") return "secondary";
  return "outline";
}

export default function AttendancePage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [className, setClassName] = useState("");
  const today = useMemo(() => new Date(), []);
  const defaultRollcallEnd = useMemo(() => isoLocalDate(today), [today]);
  const defaultRollcallStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return isoLocalDate(d);
  }, [today]);

  const [rollcallDateStart, setRollcallDateStart] = useState(defaultRollcallStart);
  const [rollcallDateEnd, setRollcallDateEnd] = useState(defaultRollcallEnd);
  const [classDateStart, setClassDateStart] = useState("");
  const [classDateEnd, setClassDateEnd] = useState("");
  const [stateFilter, setStateFilter] = useState("正常");

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const r = await getAttendance({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      teacherName: teacherName || undefined,
      className: className || undefined,
      status: stateFilter === "all" ? undefined : stateFilter,
      rollcallDateStart: rollcallDateStart || undefined,
      rollcallDateEnd: rollcallDateEnd || undefined,
      classDateStart: classDateStart || undefined,
      classDateEnd: classDateEnd || undefined,
    });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [keyword, teacherName, className, stateFilter, rollcallDateStart, rollcallDateEnd, classDateStart, classDateEnd]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "上课记录加载失败");
    });
  }, [load]);


  const columns = useMemo<Array<ColumnDef<AttendanceRecord>>>(() => [
    { key: "rollcallTime", title: "点名时间" },
    { key: "className", title: "班级名称" },
    { key: "courseName", title: "授课课程" },
    { key: "classTimeRange", title: "上课时间" },
    { key: "teacherName", title: "上课老师" },
    { key: "teachingHours", title: "授课课时" },
    { key: "attendanceSummary", title: "实到人数" },
    { key: "consumedAmountYuan", title: "课消金额", render: (row) => row.consumedAmountYuan ? `￥${row.consumedAmountYuan.toFixed(2)}` : "0" },
    { key: "status", title: "状态", render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
  ], []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">上课记录</h2>
            <p className="text-sm text-muted-foreground">参照小麦助教：按时间筛选、班级/老师/学员筛选、点名状态与消课记录联动。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input className="max-w-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索班级/课程/老师" />
            <Input className="max-w-40" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="老师" />
            <Input className="max-w-52" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="班级" />
            <Input type="date" className="max-w-44" value={classDateStart} onChange={(e) => setClassDateStart(e.target.value)} />
            <Input type="date" className="max-w-44" value={classDateEnd} onChange={(e) => setClassDateEnd(e.target.value)} />
            <Input type="date" className="max-w-44" value={rollcallDateStart} onChange={(e) => setRollcallDateStart(e.target.value)} />
            <Input type="date" className="max-w-44" value={rollcallDateEnd} onChange={(e) => setRollcallDateEnd(e.target.value)} />
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="正常">正常</SelectItem>
                <SelectItem value="已作废">已作废</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void load(1)}>查询</Button>
            <Button variant="outline" onClick={() => { setKeyword(""); setTeacherName(""); setClassName(""); setClassDateStart(""); setClassDateEnd(""); setRollcallDateStart(defaultRollcallStart); setRollcallDateEnd(defaultRollcallEnd); setStateFilter("正常"); void load(1); }}>重置</Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? <LoadingState text="上课记录加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <DataTable rows={rows} columns={columns} onRowClick={(row) => router.push(`/attendance/${encodeURIComponent(row.id)}`)} />
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

    </div>
  );
}
