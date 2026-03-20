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
import { getOrders } from "@/src/services/core-service";
import type { Order } from "@/src/types/domain";

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "待支付" | "已支付" | "已作废">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "报名" | "续费" | "退费">("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const result = await getOrders({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      orderType: typeFilter === "all" ? undefined : typeFilter,
    });
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }, [keyword, statusFilter, typeFilter]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载订单列表失败");
    });
  }, [load]);

  const columns: Array<ColumnDef<Order>> = useMemo(
    () => [
      { key: "orderNo", title: "订单号" },
      { key: "studentName", title: "学员姓名" },
      { key: "orderType", title: "订单类型" },
      {
        key: "status",
        title: "订单状态",
        render: (row) => <Badge variant={row.status === "已支付" ? "default" : row.status === "待支付" ? "secondary" : "outline"}>{row.status}</Badge>,
      },
      { key: "receivableYuan", title: "应收金额（元）" },
      { key: "paidYuan", title: "实收金额（元）" },
      { key: "arrearsYuan", title: "欠费金额（元）" },
      { key: "createdAt", title: "创建时间" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="订单管理"
        description="统一管理报名、续费、退费订单。"
        actions={
          <>
            <Button onClick={() => toast.success("新建订单（演示）")}>新建订单</Button>
            <Button variant="outline" onClick={() => toast.success("收款（演示）")}>
              收款
            </Button>
            <Button variant="outline" onClick={() => toast.success("退费（演示）")}>
              退费
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              作废
            </Button>
          </>
        }
      />

      <FilterBar
        onReset={() => {
          setKeyword("");
          setStatusFilter("all");
          setTypeFilter("all");
          void load(1);
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="学员/订单号">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="请输入关键词" />
        </FilterField>
        <FilterField label="订单状态">
          <Select value={statusFilter} onValueChange={(value: "all" | "待支付" | "已支付" | "已作废") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="待支付">待支付</SelectItem>
              <SelectItem value="已支付">已支付</SelectItem>
              <SelectItem value="已作废">已作废</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="订单类型">
          <Select value={typeFilter} onValueChange={(value: "all" | "报名" | "续费" | "退费") => setTypeFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="报名">报名</SelectItem>
              <SelectItem value="续费">续费</SelectItem>
              <SelectItem value="退费">退费</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="订单列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} onRowClick={(row) => setSelected(row)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.success("打印（演示）")}>
                  打印
                </Button>
                <Button variant="outline" onClick={() => toast.success("导出订单（演示）")}>
                  导出订单
                </Button>
              </div>
            </CardContent>
          </Card>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <DetailSheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={selected ? `${selected.orderNo} - 订单详情` : "订单详情"}>
        {selected ? (
          <div className="grid gap-2 text-sm">
            <DetailRow label="订单号" value={selected.orderNo} />
            <DetailRow label="学员姓名" value={selected.studentName} />
            <DetailRow label="订单类型" value={selected.orderType} />
            <DetailRow label="订单状态" value={selected.status} />
            <DetailRow label="应收金额" value={`${selected.receivableYuan} 元`} />
            <DetailRow label="实收金额" value={`${selected.paidYuan} 元`} />
            <DetailRow label="欠费金额" value={`${selected.arrearsYuan} 元`} />
            <DetailRow label="创建时间" value={selected.createdAt} />
          </div>
        ) : null}
      </DetailSheet>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认作废订单"
        description="作废操作不可撤销，请确认订单信息无误后继续。"
        confirmText="确认作废"
        onConfirm={() => toast.success("已作废订单（演示）")}
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
