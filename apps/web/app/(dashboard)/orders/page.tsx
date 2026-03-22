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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createRenewalOrder, getOrders, getStudents, refundOrder, voidOrder } from "@/src/services/core-service";
import type { Order } from "@/src/types/domain";

const PAGE_SIZE = 20;

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

  // Renewal dialog
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewStudentId, setRenewStudentId] = useState("");
  const [renewStudentName, setRenewStudentName] = useState("");
  const [renewAmount, setRenewAmount] = useState("0");
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // Void dialog
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidOrder_, setVoidOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundOrder_, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

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

  const openRenew = async () => {
    setRenewAmount("0");
    setRenewStudentId("");
    setRenewStudentName("");
    setRenewOpen(true);
  };

  const submitRenew = async () => {
    if (!renewStudentId.trim()) {
      toast.warning("请填写学员ID");
      return;
    }
    const amount = Math.max(0, Number(renewAmount || "0"));
    if (amount <= 0) {
      toast.warning("请填写正确的续费金额");
      return;
    }
    setRenewSubmitting(true);
    try {
      const result = await createRenewalOrder({
        studentId: renewStudentId.trim(),
        receivableCents: Math.round(amount * 100),
        paidCents: Math.round(amount * 100),
        arrearsCents: 0,
      });
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success("续费订单创建成功");
      setRenewOpen(false);
      await load(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "续费失败");
    } finally {
      setRenewSubmitting(false);
    }
  };

  const openVoid = (order: Order) => {
    setVoidOrder(order);
    setVoidReason("");
    setVoidOpen(true);
  };

  const submitVoid = async () => {
    if (!voidOrder_) return;
    setVoidSubmitting(true);
    try {
      const result = await voidOrder(voidOrder_.orderNo, voidReason.trim() || undefined);
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success(`订单 ${voidOrder_.orderNo} 已作废`);
      setVoidOpen(false);
      setSelected(null);
      await load(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "作废失败");
    } finally {
      setVoidSubmitting(false);
    }
  };

  const openRefund = (order: Order) => {
    setRefundOrder(order);
    setRefundReason("");
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    if (!refundOrder_) return;
    setRefundSubmitting(true);
    try {
      const result = await refundOrder(refundOrder_.orderNo, refundReason.trim() || undefined);
      if (result.kind === "forbidden") { setStatus("forbidden"); return; }
      toast.success(`订单 ${refundOrder_.orderNo} 已退费`);
      setRefundOpen(false);
      setSelected(null);
      await load(1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "退费失败");
    } finally {
      setRefundSubmitting(false);
    }
  };

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
      {
        key: "actions", title: "操作",
        render: (row) => (
          <div className="flex gap-1 flex-wrap">
            {row.status !== "已作废" && (
              <>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openVoid(row); }}>作废</Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openRefund(row); }}>退费</Button>
              </>
            )}
          </div>
        ),
      },
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
            <Button onClick={() => void openRenew()}>新建订单</Button>
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
            <SelectTrigger><SelectValue placeholder="全部状态" /></SelectTrigger>
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
            <SelectTrigger><SelectValue placeholder="全部类型" /></SelectTrigger>
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

      {/* Renewal dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建订单（续费）</DialogTitle>
            <DialogDescription>为学员创建一笔续费订单。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input
              placeholder="学员ID（source_student_id）"
              value={renewStudentId}
              onChange={(e) => setRenewStudentId(e.target.value)}
            />
            <Input
              type="number"
              placeholder="续费金额（元）"
              value={renewAmount}
              onChange={(e) => setRenewAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>取消</Button>
            <Button disabled={renewSubmitting} onClick={() => void submitRenew()}>
              {renewSubmitting ? "提交中..." : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认作废订单</DialogTitle>
            <DialogDescription>
              确定要作废订单 <strong>{voidOrder_?.orderNo}</strong> 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input
              placeholder="作废原因（可选）"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>取消</Button>
            <Button variant="destructive" disabled={voidSubmitting} onClick={() => void submitVoid()}>
              {voidSubmitting ? "作废中..." : "确认作废"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退费订单</DialogTitle>
            <DialogDescription>
              确定要为学员退费订单 <strong>{refundOrder_?.orderNo}</strong> 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input
              placeholder="退费原因（可选）"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>取消</Button>
            <Button variant="destructive" disabled={refundSubmitting} onClick={() => void submitRefund()}>
              {refundSubmitting ? "退费中..." : "确认退费"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
