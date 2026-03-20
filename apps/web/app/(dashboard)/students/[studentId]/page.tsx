"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  payments: Array<{
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
    return { paidYuan, receivableYuan, arrearsYuan: Math.max(receivableYuan - paidYuan, 0) };
  }, [orders]);

  return (
    <div className="space-y-4">
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
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{profile.student.name}</CardTitle>
                <Badge>{profile.student.status || "-"}</Badge>
                <Button size="sm">报名</Button>
                <Button size="sm" variant="outline">试听</Button>
                <Button size="sm" variant="outline">编辑资料</Button>
                <Button size="sm" variant="outline">更多操作</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="手机号" value={profile.student.phone || "-"} />
              <DetailRow label="性别" value={profile.student.gender || "-"} />
              <DetailRow label="出生日期" value={profile.student.birthday || "-"} />
              <DetailRow label="状态" value={profile.student.status || "-"} />
              <DetailRow label="创建时间" value={profile.student.source_created_at || "-"} />
              <DetailRow label="累计订单" value={`${orders.length}`} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap gap-2 p-4">
              {TABS.map((item) => (
                <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>

          {tab === "报读课程" ? (
            <div className="space-y-4">
              <section className="grid gap-3 md:grid-cols-3">
                <MetricCard label="应收总额（元）" value={summary.receivableYuan.toFixed(2)} />
                <MetricCard label="实收总额（元）" value={summary.paidYuan.toFixed(2)} />
                <MetricCard label="欠费总额（元）" value={summary.arrearsYuan.toFixed(2)} />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>报读课程（订单明细）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {profile.courses.map((item, idx) => (
                    <div key={`${item.order_no}-${idx}`} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline">{item.order_state || "-"}</Badge>
                        <span className="text-muted-foreground">订单号：{item.order_no || "-"}</span>
                      </div>
                      <p>课程：{item.course_name || "-"}</p>
                      <p>已收金额：¥{centsToYuan(item.paid_cents)}</p>
                      <p className="text-muted-foreground">创建时间：{item.source_created_at || "-"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline">续费</Button>
                        <Button size="sm" variant="outline">转课</Button>
                        <Button size="sm" variant="outline">退课</Button>
                        <Button size="sm" variant="outline">结课</Button>
                      </div>
                    </div>
                  ))}
                  {profile.courses.length === 0 ? <p className="text-sm text-muted-foreground">暂无报读课程</p> : null}
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
                {profile.payments.map((item, idx) => (
                  <div key={`${item.source_id}-${idx}`} className="rounded-lg border p-3">
                    <p>
                      {item.operation_date || "-"} · {item.item_type || "-"} · {item.direction || "-"} · ¥{centsToYuan(item.amount_cents)}
                    </p>
                    <p className="text-muted-foreground">流水号：{item.source_id || "-"} ｜ 订单号：{item.source_order_id || "-"}</p>
                  </div>
                ))}
                {profile.payments.length === 0 ? <p className="text-muted-foreground">暂无消费记录</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {tab === "上课记录" ? (
            <Card>
              <CardHeader>
                <CardTitle>上课记录（原“消课记录”）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profile.consumption.map((item) => (
                  <div key={item.source_id} className="rounded-lg border p-3">
                    <p>{item.checked_at || "-"} · {item.course_name || "-"} · 消课 {item.consumed_lessons}</p>
                    <p className="text-muted-foreground">班级：{item.class_name || "-"} ｜ 老师：{item.teacher_names || "-"}</p>
                  </div>
                ))}
                {profile.consumption.length === 0 ? <p className="text-muted-foreground">暂无上课记录</p> : null}
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
