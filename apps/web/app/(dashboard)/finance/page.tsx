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
import { createFinanceRecord, exportIncomeExpenseCsv, getFinanceRecords, updateFinanceRecord, voidFinanceRecord } from "@/src/services/core-service";
import type { FinanceRecord, FinanceSummary } from "@/src/types/domain";

const PAGE_SIZE = 10;

type FinanceForm = {
  sourceRecordId: string;
  bizType: string;
  direction: "收入" | "支出";
  amountYuan: string;
  paymentMethod: FinanceRecord["paymentMethod"];
  operator: string;
  occurredAt: string;
  remark: string;
  status: "正常" | "作废";
};

const defaultForm: FinanceForm = {
  sourceRecordId: "",
  bizType: "",
  direction: "收入",
  amountYuan: "",
  paymentMethod: "微信",
  operator: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  remark: "",
  status: "正常",
};

function toCents(yuan: string): number {
  return Math.round(Number(yuan || 0) * 100);
}

export default function FinancePage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<FinanceRecord[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "收入" | "支出">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<"all" | FinanceRecord["paymentMethod"]>("all");
  const [form, setForm] = useState<FinanceForm>(defaultForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getFinanceRecords({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      direction: directionFilter === "all" ? undefined : directionFilter,
      paymentMethod: paymentMethodFilter === "all" ? undefined : paymentMethodFilter,
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

  function resetForm() {
    setForm({ ...defaultForm, occurredAt: new Date().toISOString().slice(0, 10) });
    setEditingRecordId(null);
  }

  async function handleSubmit() {
    if (!form.bizType.trim()) {
      toast.error("请填写项目类型");
      return;
    }
    if (!form.occurredAt) {
      toast.error("请选择日期");
      return;
    }
    const amountCents = toCents(form.amountYuan);
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      toast.error("请填写有效金额");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sourceRecordId: form.sourceRecordId.trim() || undefined,
        itemType: form.bizType.trim(),
        direction: form.direction,
        amountCents,
        operationDate: form.occurredAt,
        paymentMethod: form.paymentMethod,
        operator: form.operator.trim() || "-",
        remark: form.remark.trim(),
        status: form.status,
      };
      const result = editingRecordId
        ? await updateFinanceRecord(editingRecordId, payload)
        : await createFinanceRecord(payload);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success(editingRecordId ? "收支记录已更新" : "收支记录已新增");
      resetForm();
      await load(editingRecordId ? page : 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(row: FinanceRecord) {
    setEditingRecordId(row.serialNo);
    setForm({
      sourceRecordId: row.serialNo,
      bizType: row.bizType,
      direction: row.direction,
      amountYuan: String(row.amountYuan),
      paymentMethod: row.paymentMethod,
      operator: row.operator === "-" ? "" : row.operator,
      occurredAt: row.occurredAt === "-" ? defaultForm.occurredAt : row.occurredAt,
      remark: row.remark,
      status: row.status,
    });
  }

  async function handleVoid(row: FinanceRecord) {
    try {
      const result = await voidFinanceRecord(row.serialNo, { operator: "web", reason: "manual_void" });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("记录已作废");
      await load(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "作废失败");
    }
  }

  async function handleExport() {
    const result = await exportIncomeExpenseCsv({
      q: keyword || undefined,
      direction: directionFilter === "all" ? undefined : directionFilter,
      paymentMethod: paymentMethodFilter === "all" ? undefined : paymentMethodFilter,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    if (result.kind === "ok") {
      const url = URL.createObjectURL(result.data.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("收支明细已导出 CSV");
    }
  }

  const columns: Array<ColumnDef<FinanceRecord>> = useMemo(
    () => [
      { key: "serialNo", title: "流水号" },
      { key: "bizType", title: "项目" },
      {
        key: "direction",
        title: "收支方向",
        render: (row) => <Badge variant={row.direction === "收入" ? "default" : "secondary"}>{row.direction}</Badge>,
      },
      { key: "amountYuan", title: "金额（元）" },
      { key: "paymentMethod", title: "支付方式" },
      { key: "operator", title: "经办人" },
      {
        key: "status",
        title: "状态",
        render: (row) => <Badge variant={row.status === "作废" ? "outline" : "default"}>{row.status}</Badge>,
      },
      { key: "occurredAt", title: "发生时间" },
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
              variant="destructive"
              disabled={row.status === "作废"}
              onClick={(event) => {
                event.stopPropagation();
                void handleVoid(row);
              }}
            >
              作废
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
        title="收支明细"
        description="管理财务台账，支持收入、支出与净收入统计。"
        actions={<><Button onClick={resetForm}>新增收支</Button><Button variant="outline" onClick={() => void handleExport()}>导出 CSV</Button></>}
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="流水号（可选）"
              value={form.sourceRecordId}
              onChange={(event) => setForm((prev) => ({ ...prev, sourceRecordId: event.target.value }))}
              disabled={Boolean(editingRecordId)}
            />
            <Input
              placeholder="项目"
              value={form.bizType}
              onChange={(event) => setForm((prev) => ({ ...prev, bizType: event.target.value }))}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="金额（元）"
              value={form.amountYuan}
              onChange={(event) => setForm((prev) => ({ ...prev, amountYuan: event.target.value }))}
            />
            <Input
              type="date"
              value={form.occurredAt}
              onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
            />
            <Select
              value={form.direction}
              onValueChange={(value: "收入" | "支出") => setForm((prev) => ({ ...prev, direction: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="收支方向" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="收入">收入</SelectItem>
                <SelectItem value="支出">支出</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select
              value={form.paymentMethod}
              onValueChange={(value: FinanceRecord["paymentMethod"]) => setForm((prev) => ({ ...prev, paymentMethod: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="支付方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="微信">微信</SelectItem>
                <SelectItem value="支付宝">支付宝</SelectItem>
                <SelectItem value="现金">现金</SelectItem>
                <SelectItem value="转账">转账</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="经办人"
              value={form.operator}
              onChange={(event) => setForm((prev) => ({ ...prev, operator: event.target.value }))}
            />
            <Input
              placeholder="备注"
              value={form.remark}
              onChange={(event) => setForm((prev) => ({ ...prev, remark: event.target.value }))}
            />
            <Select
              value={form.status}
              onValueChange={(value: "正常" | "作废") => setForm((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="正常">正常</SelectItem>
                <SelectItem value="作废">作废</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {editingRecordId ? "保存编辑" : "新增收支"}
            </Button>
            {editingRecordId ? (
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
          setDirectionFilter("all");
          setPaymentMethodFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="关键词（流水号/项目/经办人）">
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
        <FilterField label="支付方式">
          <Select
            value={paymentMethodFilter}
            onValueChange={(value: "all" | FinanceRecord["paymentMethod"]) => setPaymentMethodFilter(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部方式</SelectItem>
              <SelectItem value="微信">微信</SelectItem>
              <SelectItem value="支付宝">支付宝</SelectItem>
              <SelectItem value="现金">现金</SelectItem>
              <SelectItem value="转账">转账</SelectItem>
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
