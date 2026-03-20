"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/page-header";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    source_created_at: string | null;
  }>;
  consumption: Array<{
    source_id: string;
    class_name: string;
    course_name: string;
    teacher_names: string;
    consumed_lessons: number;
    checked_at: string | null;
  }>;
  rollcalls: Array<{
    source_row_hash: string;
    class_name: string;
    course_name: string;
    teacher_name: string;
    rollcall_time: string;
    status: string;
  }>;
  payments: Array<{
    source_id: string;
    source_order_id: string;
    item_type: string;
    direction: string;
    amount_cents: number;
    operation_date: string;
    source_created_at: string;
  }>;
};

const TABS = ["基本信息", "报读课程", "消费记录", "消课记录", "上课记录"] as const;
type TabKey = (typeof TABS)[number];

function toYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatDateCn(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`;
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("基本信息");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    async function load() {
      setStatus("loading");
      const [profileRes, orderRes] = await Promise.all([
        getStudentProfile(studentId),
        getOrders({ page: 1, pageSize: 50, studentId }),
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

  const orderSummary = useMemo(() => {
    const paidYuan = orders.reduce((sum, o) => sum + o.paidYuan, 0);
    const receivableYuan = orders.reduce((sum, o) => sum + o.receivableYuan, 0);
    return { paidYuan, receivableYuan, arrearsYuan: Math.max(receivableYuan - paidYuan, 0) };
  }, [orders]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="学员详情"
        description={`学员ID：${studentId}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => toast.success("报名功能（下一步接入）")}>报名</Button>
            <Button variant="outline" onClick={() => toast.success("试听功能（下一步接入）")}>试听</Button>
            <Button variant="outline" onClick={() => toast.success("编辑资料功能（下一步接入）")}>编辑资料</Button>
            <Button variant="outline" onClick={() => toast.success("更多操作（停课/结课/删除）即将接入")}>更多操作</Button>
            <Link href="/students">
              <Button variant="outline">返回学员列表</Button>
            </Link>
          </div>
        }
      />

      {status === "loading" ? <LoadingState text="正在加载学员详情..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" && profile ? (
        <>
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-4">
              {TABS.map((item) => (
                <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>

          {tab === "基本信息" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {profile.student.name}
                  <Badge>{profile.student.status || "-"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <DetailRow label="手机号" value={profile.student.phone || "-"} />
                <DetailRow label="性别" value={profile.student.gender || "-"} />
                <DetailRow label="出生日期" value={formatDateCn(profile.student.birthday)} />
                <DetailRow label="创建时间" value={formatDateCn(profile.student.source_created_at)} />
                <DetailRow label="累计订单" value={`${orders.length}`} />
                <DetailRow label="累计消费记录" value={`${profile.payments?.length ?? 0}`} />
              </CardContent>
            </Card>
          ) : null}

          {tab === "报读课程" ? (
            <div className="space-y-4">
              <section className="grid gap-3 md:grid-cols-3">
                <MetricCard label="应收总额（元）" value={orderSummary.receivableYuan.toFixed(2)} />
                <MetricCard label="实收总额（元）" value={orderSummary.paidYuan.toFixed(2)} />
                <MetricCard label="欠费总额（元）" value={orderSummary.arrearsYuan.toFixed(2)} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    报读课程 / 订单日志
                    <Button size="sm" variant="outline" onClick={() => toast.success("续费功能（下一步接入）")}>续费</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success("转课功能（下一步接入）")}>转课</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success("退课功能（下一步接入）")}>退课</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success("结课功能（下一步接入）")}>结课</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.success("选班调班功能（下一步接入）")}>选班调班</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="rounded-lg border p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline">{order.orderType}</Badge>
                        <Badge>{order.status}</Badge>
                        <span className="text-muted-foreground">{order.orderNo}</span>
                      </div>
                      <p>应收：¥{order.receivableYuan.toFixed(2)} ｜ 实收：¥{order.paidYuan.toFixed(2)} ｜ 欠费：¥{order.arrearsYuan.toFixed(2)}</p>
                      <p className="text-muted-foreground">创建时间：{order.createdAt}</p>
                    </div>
                  ))}
                  {orders.length === 0 ? <p className="text-sm text-muted-foreground">暂无订单记录</p> : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === "消费记录" ? (
            <Card>
              <CardHeader>
                <CardTitle>消费记录（收支流水）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(profile.payments ?? []).map((item) => (
                  <div key={`${item.source_id}-${item.source_order_id}-${item.source_created_at}`} className="rounded-lg border p-3">
                    <p>
                      {formatDateCn(item.operation_date)} · {item.item_type || "-"} · {item.direction || "-"}
                    </p>
                    <p className="text-muted-foreground">
                      金额：¥{toYuan(Number(item.amount_cents ?? 0))} ｜ 订单号：{item.source_order_id || "-"}
                    </p>
                  </div>
                ))}
                {!(profile.payments ?? []).length ? <p className="text-muted-foreground">暂无消费记录</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === "消课记录" ? (
            <Card>
              <CardHeader>
                <CardTitle>消课记录（课时扣减）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.consumption.map((item) => (
                  <div key={item.source_id} className="rounded-lg border p-3">
                    <p>{formatDateCn(item.checked_at)} · {item.course_name || "-"} · 消课 {item.consumed_lessons}</p>
                    <p className="text-muted-foreground">班级：{item.class_name || "-"} ｜ 老师：{item.teacher_names || "-"}</p>
                  </div>
                ))}
                {profile.consumption.length === 0 ? <p className="text-muted-foreground">暂无消课记录</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === "上课记录" ? (
            <Card>
              <CardHeader>
                <CardTitle>上课记录（考勤打卡）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.rollcalls.map((item) => (
                  <div key={item.source_row_hash} className="rounded-lg border p-3">
                    <p>{formatDateCn(item.rollcall_time)} · {item.class_name || "-"} · {item.course_name || "-"}</p>
                    <p className="text-muted-foreground">老师：{item.teacher_name || "-"} ｜ 状态：{item.status || "-"}</p>
                  </div>
                ))}
                {profile.rollcalls.length === 0 ? <p className="text-muted-foreground">暂无上课记录</p> : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
