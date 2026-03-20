"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PageHeader } from "@/components/common/page-header";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrders, getStudentProfile } from "@/src/services/core-service";
import type { Order } from "@/src/types/domain";

type ProfileData = {
  student: {
    source_student_id: string;
    name: string;
    phone: string;
    gender: string;
    birthday: string | null;
    status: string;
    source_created_at: string | null;
  };
  courses: Array<{
    order_no: string;
    course_name: string;
    order_state: string;
    paid_cents: number;
    receivable_cents: number;
    source_created_at: string | null;
    purchased_lessons: number;
    gift_lessons: number;
    consumed_lessons: number;
    transfer_lessons: number;
    remain_lessons: number;
  }>;
  consumption: Array<{
    source_id: string;
    class_name: string;
    course_name: string;
    teacher_names: string;
    consumed_lessons: number;
    checked_at: string | null;
  }>;
  payments?: Array<{
    source_id: string;
    source_order_id: string;
    item_type: string;
    direction: string;
    amount_cents: number;
    operation_date: string | null;
    source_created_at: string | null;
  }>;
};

const TABS = ["报读课程", "消费记录", "上课记录"] as const;
type TabKey = (typeof TABS)[number];

function centsToYuan(v?: number | null): string {
  return ((v ?? 0) / 100).toFixed(2);
}

function formatCnDateTime(v?: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mapGender(v?: string | null): string {
  if (!v) return "-";
  if (["WOMEN", "女", "FEMALE"].includes(v)) return "女";
  if (["MAN", "男", "MALE"].includes(v)) return "男";
  return "未知";
}

function mapStatus(v?: string | null): string {
  if (!v) return "-";
  if (["NORMAL", "LEARNING", "在读", "ACTIVE"].includes(v)) return "在读";
  if (["SUSPENDED", "PAUSED", "停课"].includes(v)) return "停课";
  return "结课";
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("报读课程");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    async function load() {
      setStatus("loading");
      const [profileRes, orderRes] = await Promise.all([
        getStudentProfile(studentId),
        getOrders({ page: 1, pageSize: 100, studentId }),
      ]);

      if (profileRes.kind === "forbidden" || orderRes.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }

      setProfile(profileRes.data as ProfileData);
      setOrders(orderRes.data.items);
      setStatus("ready");
    }

    load().catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "学员详情加载失败");
    });
  }, [studentId]);

  const summary = useMemo(() => {
    const paidYuan = orders.reduce((sum, o) => sum + o.paidYuan, 0);
    const receivableYuan = orders.reduce((sum, o) => sum + o.receivableYuan, 0);
    const remainLessons = (profile?.courses ?? []).reduce((sum, x) => sum + Number(x.remain_lessons ?? 0), 0);
    const consumedLessons = (profile?.courses ?? []).reduce((sum, x) => sum + Number(x.consumed_lessons ?? 0), 0);
    const purchasedLessons = (profile?.courses ?? []).reduce((sum, x) => sum + Number(x.purchased_lessons ?? 0) + Number(x.gift_lessons ?? 0), 0);
    return {
      paidYuan,
      receivableYuan,
      arrearsYuan: Math.max(receivableYuan - paidYuan, 0),
      remainLessons,
      consumedLessons,
      purchasedLessons,
    };
  }, [orders, profile]);

  const paymentRows = useMemo(() => {
    const raw = profile?.payments ?? [];
    if (raw.length) return raw;
    return orders
      .filter((o) => o.paidYuan > 0 || o.receivableYuan > 0)
      .map((o) => ({
        source_id: `ORDER-${o.orderNo}`,
        source_order_id: o.orderNo,
        item_type: "订单收款",
        direction: "收入",
        amount_cents: Math.round((o.paidYuan > 0 ? o.paidYuan : o.receivableYuan) * 100),
        operation_date: o.createdAt,
        source_created_at: o.createdAt,
      }));
  }, [profile, orders]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="学员详情"
        description={`学员ID：${studentId}`}
        actions={
          <Link href="/students">
            <Button variant="outline">返回学员列表</Button>
          </Link>
        }
      />

      {status === "loading" ? <LoadingState text="正在加载学员详情..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" && profile ? (
        <>
          <section className="rounded-xl border bg-background p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{profile.student.name}</h2>
                  <Badge>{mapStatus(profile.student.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{profile.student.phone || "-"} · {mapGender(profile.student.gender)} · 出生日期 {formatCnDateTime(profile.student.birthday)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">报名</Button>
                <Button size="sm" variant="outline">试听</Button>
                <Button size="sm" variant="outline">编辑资料</Button>
                <Button size="sm" variant="outline">更多操作</Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4 lg:grid-cols-8">
              <Kpi label="剩余课时" value={`${summary.remainLessons}`} />
              <Kpi label="已消耗课时" value={`${summary.consumedLessons}`} />
              <Kpi label="合计购买课时" value={`${summary.purchasedLessons}`} />
              <Kpi label="应收总额" value={`¥${summary.receivableYuan.toFixed(2)}`} />
              <Kpi label="实收总额" value={`¥${summary.paidYuan.toFixed(2)}`} />
              <Kpi label="欠费总额" value={`¥${summary.arrearsYuan.toFixed(2)}`} />
              <Kpi label="订单数" value={`${orders.length}`} />
              <Kpi label="创建时间" value={formatCnDateTime(profile.student.source_created_at)} />
            </div>
          </section>

          <section className="border-b">
            <div className="flex gap-6 px-1">
              {TABS.map((item) => (
                <button
                  key={item}
                  className={`border-b-2 pb-2 text-sm ${tab === item ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {tab === "报读课程" ? (
            <section className="overflow-hidden rounded-xl border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">报读课程（订单明细）</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>订单号</Th><Th>课程</Th><Th>购买</Th><Th>赠送</Th><Th>已消耗</Th><Th>退转</Th><Th>剩余</Th><Th>实收/应收</Th><Th>创建时间</Th><Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.courses ?? []).map((item, idx) => (
                      <tr key={`${item.order_no}-${idx}`} className="border-t">
                        <Td>{item.order_no || "-"}</Td>
                        <Td>{item.course_name || "-"}</Td>
                        <Td>{item.purchased_lessons ?? 0}</Td>
                        <Td>{item.gift_lessons ?? 0}</Td>
                        <Td>{item.consumed_lessons ?? 0}</Td>
                        <Td>{item.transfer_lessons ?? 0}</Td>
                        <Td>{item.remain_lessons ?? 0}</Td>
                        <Td>¥{centsToYuan(item.paid_cents)} / ¥{centsToYuan(item.receivable_cents)}</Td>
                        <Td>{formatCnDateTime(item.source_created_at)}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="outline">续费</Button>
                            <Button size="sm" variant="outline">转课</Button>
                            <Button size="sm" variant="outline">退课</Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!(profile.courses ?? []).length ? <div className="p-4 text-sm text-muted-foreground">暂无报读课程</div> : null}
            </section>
          ) : null}

          {tab === "消费记录" ? (
            <section className="overflow-hidden rounded-xl border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">消费记录（收支流水）</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>日期</Th><Th>类型</Th><Th>方向</Th><Th>金额</Th><Th>订单号</Th><Th>流水号</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((item, idx) => (
                      <tr key={`${item.source_id}-${idx}`} className="border-t">
                        <Td>{formatCnDateTime(item.operation_date)}</Td>
                        <Td>{item.item_type || "-"}</Td>
                        <Td>{item.direction || "-"}</Td>
                        <Td>¥{centsToYuan(item.amount_cents)}</Td>
                        <Td>{item.source_order_id || "-"}</Td>
                        <Td>{item.source_id || "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!paymentRows.length ? <div className="p-4 text-sm text-muted-foreground">暂无消费记录</div> : null}
            </section>
          ) : null}

          {tab === "上课记录" ? (
            <section className="overflow-hidden rounded-xl border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">上课记录（课耗流水）</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>上课时间</Th><Th>课程</Th><Th>班级</Th><Th>老师</Th><Th>消课数</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.consumption ?? []).map((item) => (
                      <tr key={item.source_id} className="border-t">
                        <Td>{formatCnDateTime(item.checked_at)}</Td>
                        <Td>{item.course_name || "-"}</Td>
                        <Td>{item.class_name || "-"}</Td>
                        <Td>{item.teacher_names || "-"}</Td>
                        <Td>{item.consumed_lessons}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!(profile.consumption ?? []).length ? <div className="p-4 text-sm text-muted-foreground">暂无上课记录</div> : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-medium">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
