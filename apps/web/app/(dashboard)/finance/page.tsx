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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFinanceRecords } from "@/src/services/core-service";
import type { FinanceRecord, FinanceSummary } from "@/src/types/domain";

const PAGE_SIZE = 10;

export default function FinancePage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<FinanceRecord[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "收入" | "支出">("all");

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getFinanceRecords({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      direction: directionFilter === "all" ? undefined : directionFilter,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data.list.items);
    setTotal(result.data.list.total);
    setPage(result.data.list.page);
    setSummary(result.data.summary);
    setStatus("ready");
  }, [keyword, directionFilter]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载收支明细失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<FinanceRecord>> = useMemo(
    () => [
      { key: "serialNo", title: "流水号" },
      { key: "bizType", title: "业务类型" },
      {
        key: "direction",
        title: "收支方向",
        render: (row) => <Badge variant={row.direction === "收入" ? "default" : "secondary"}>{row.direction}</Badge>,
      },
      { key: "amountYuan", title: "金额（元）" },
      { key: "paymentMethod", title: "支付方式" },
      { key: "operator", title: "经办人" },
      { key: "occurredAt", title: "发生时间" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="收支明细"
        description="管理财务台账，支持收入、支出与净收入统计。"
        actions={
          <>
            <Button onClick={() => toast.success("新增收支（演示）")}>新增收支</Button>
            <Button variant="outline" onClick={() => toast.success("导出明细（演示）")}>
              导出明细
            </Button>
            <Button variant="outline" onClick={() => toast.success("月度汇总（演示）")}>
              月度汇总
            </Button>
          </>
        }
      />

      <FilterBar
        onReset={() => {
          setKeyword("");
          setDirectionFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="关键词（流水号/业务类型/经办人）">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入关键词" />
        </FilterField>
        <FilterField label="收支方向">
          <Select value={directionFilter} onValueChange={(value: "all" | "收入" | "支出") => setDirectionFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部方向" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部方向</SelectItem>
              <SelectItem value="收入">收入</SelectItem>
              <SelectItem value="支出">支出</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="收支明细加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <SummaryCard title="总收入（元）" value={summary?.totalIncomeYuan ?? 0} />
            <SummaryCard title="总支出（元）" value={summary?.totalExpenseYuan ?? 0} />
            <SummaryCard title="净收入（元）" value={summary?.netIncomeYuan ?? 0} />
          </section>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.success("查看明细（演示）")}>
                  查看
                </Button>
                <Button variant="outline" onClick={() => toast.success("编辑明细（演示）")}>
                  编辑
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

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
