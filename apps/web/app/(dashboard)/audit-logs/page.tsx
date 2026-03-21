"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { FilterBar } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportAuditLogsCsv, getAuditLogs } from "@/src/services/core-service";
import type { AuditLogItem } from "@/src/types/domain";

const DEFAULT_LIMIT = 50;

export default function AuditLogsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [action, setAction] = useState("");
  const [operator, setOperator] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    const result = await getAuditLogs({
      action: action.trim() || undefined,
      operator: operator.trim() || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      limit: DEFAULT_LIMIT,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data);
    setStatus("ready");
  }, [action, operator, startTime, endTime]);

  useEffect(() => {
    load().catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载审计日志失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<AuditLogItem>> = useMemo(
    () => [
      { key: "createdAt", title: "时间" },
      { key: "operator", title: "操作者" },
      { key: "role", title: "角色" },
      { key: "action", title: "动作" },
      { key: "resourceType", title: "资源类型" },
      { key: "resourceId", title: "资源ID" },
    ],
    [],
  );

  function handleReset() {
    setAction("");
    setOperator("");
    setStartTime("");
    setEndTime("");
  }

  async function handleExportCsv() {
    const result = await exportAuditLogsCsv({
      action: action.trim() || undefined,
      operator: operator.trim() || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      limit: DEFAULT_LIMIT,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    const url = URL.createObjectURL(result.data.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="审计日志" description="查看关键操作审计记录，支持按动作、操作者、时间范围筛选。" />

      <FilterBar onReset={handleReset} onQuery={() => void load()}>
        <Input placeholder="动作前缀（如 teachers.）" value={action} onChange={(e) => setAction(e.target.value)} />
        <Input placeholder="操作者" value={operator} onChange={(e) => setOperator(e.target.value)} />
        <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </FilterBar>

      <div>
        <Button variant="outline" onClick={() => void handleExportCsv()}>导出CSV</Button>
      </div>

      {status === "loading" ? <LoadingState text="加载审计日志中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {status === "forbidden" ? <ForbiddenState message="无权限执行该操作" /> : null}
      {status === "ready" ? <DataTable columns={columns} rows={rows} /> : null}
    </div>
  );
}
