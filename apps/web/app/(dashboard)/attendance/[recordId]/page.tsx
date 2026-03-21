"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAttendanceDetail } from "@/src/services/core-service";

type RollcallDetail = {
  class_name: string;
  course_name: string;
  teacher_name: string;
  rollcall_time: string;
  class_time_range: string;
  status: string;
  teaching_hours: number;
  attendance_summary: string;
  cost_amount_cents: number;
  students: Array<{
    student_name: string;
    phone?: string;
    consume_way?: string;
    arrival_status?: string;
    makeup_status?: string;
    deduct_lessons?: number;
    deduct_amount_yuan?: number;
    remark?: string;
  }>;
};

export default function AttendanceDetailPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<RollcallDetail | null>(null);

  useEffect(() => {
    getAttendanceDetail(recordId)
      .then((r) => {
        if (r.kind === "forbidden") {
          setState("forbidden");
          return;
        }
        setData(r.data as RollcallDetail);
        setState("ready");
      })
      .catch((e: unknown) => {
        setState("error");
        setError(e instanceof Error ? e.message : "点名详情加载失败");
      });
  }, [recordId]);

  if (state === "loading") return <LoadingState text="点名详情加载中..." />;
  if (state === "forbidden") return <ForbiddenState />;
  if (state === "error") return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/attendance">返回</Link></Button>
          <h2 className="text-xl font-semibold">点名详情</h2>
        </div>
        <Badge variant={data.status === "正常" ? "default" : "secondary"}>{data.status}</Badge>
      </div>

      <Card>
        <CardContent className="p-4 text-sm space-y-2">
          <p>班级：{data.class_name || "-"}</p>
          <p>授课课程：{data.course_name || "-"}</p>
          <p>上课时间：{data.class_time_range || "-"}</p>
          <p>上课老师：{data.teacher_name || "-"}</p>
          <p>点名时间：{data.rollcall_time || "-"}</p>
          <p>授课课时：{String(data.teaching_hours ?? "-")}</p>
          <p>实到人数：{data.attendance_summary || "-"}</p>
          <p>课消金额：￥{((Number(data.cost_amount_cents || 0)) / 100).toFixed(2)}</p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h3 className="font-medium">学员名单</h3>
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-3 py-2 text-left">姓名</th>
                <th className="px-3 py-2 text-left">消耗方式</th>
                <th className="px-3 py-2 text-left">到课状态</th>
                <th className="px-3 py-2 text-left">补课状态</th>
                <th className="px-3 py-2 text-left">扣除额度</th>
                <th className="px-3 py-2 text-left">备注</th>
              </tr>
            </thead>
            <tbody>
              {(data.students || []).map((s, idx) => (
                <tr key={`${s.student_name}-${idx}`} className="border-t">
                  <td className="px-3 py-2">{s.student_name || "-"}</td>
                  <td className="px-3 py-2">{s.consume_way || "-"}</td>
                  <td className="px-3 py-2">{s.arrival_status || "-"}</td>
                  <td className="px-3 py-2">{s.makeup_status || "-"}</td>
                  <td className="px-3 py-2">{String(s.deduct_lessons ?? 0)} 课时</td>
                  <td className="px-3 py-2">{s.remark || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
