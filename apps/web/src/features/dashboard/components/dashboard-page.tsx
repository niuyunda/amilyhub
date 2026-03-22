"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardOverview } from "@/src/data/core/dashboard";
import type { DashboardData } from "@/src/types/domain";

export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const result = await getDashboardOverview();
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setData(result.data);
    setStatus("ready");
  }, []);

  useEffect(() => {
    load().catch((nextError: unknown) => {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "加载失败");
    });
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="工作台"
        description="一眼查看机构运营状态、今日待办和快捷操作。"
        actions={
          <Button
            onClick={() => {
              load().then(() => toast.success("数据已刷新"));
            }}
          >
            刷新数据
          </Button>
        }
      />

      {status === "loading" ? <LoadingState text="正在加载工作台数据..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load()} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" && data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard title="学员总数" value={data.kpi.studentTotal} />
            <KpiCard title="在读学员" value={data.kpi.activeStudents} />
            <KpiCard title="本月订单" value={data.kpi.monthlyOrders} />
            <KpiCard title="本月收入（元）" value={data.kpi.monthlyIncomeYuan} />
            <KpiCard title="本月消课" value={data.kpi.monthlyConsumedHours} />
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">趋势概览</h3>
                <p className="text-xs text-muted-foreground">近 14 天核心指标（示意）</p>
              </div>
              <div className="text-xs text-muted-foreground">Last 14 days</div>
            </div>
            <div className="h-36 rounded-2xl bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>今日待办</CardTitle>
                <CardDescription>高优先级待处理事项</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.todos.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                    <span>{item.title}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>快捷入口</CardTitle>
                <CardDescription>常用业务操作入口</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {data.quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    onClick={() => {
                      const routes: Record<string, string> = {
                        student: "/students",
                        order: "/orders",
                        class: "/classes",
                        finance: "/finance",
                      };
                      const target = routes[action.id];
                      if (target) router.push(target);
                      else toast.success(`${action.label}（演示）`);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
