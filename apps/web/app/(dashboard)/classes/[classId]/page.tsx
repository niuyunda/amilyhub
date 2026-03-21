"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getClassProfile } from "@/src/services/core-service";

type ClassProfile = {
  class: {
    id: string;
    name: string;
    course_name: string;
    teacher_name: string;
    class_type: "班课" | "一对一";
    student_count: number;
    capacity: number;
    status: string;
  };
  schedules: Array<{ id: string; class_time_range: string; rollcall_time: string; teacher_name: string; status: string }>;
  students: Array<{ student_id: string; student_name: string; latest_status: string; latest_time: string; class_count: number }>;
  attendance: Array<{ id: string; student_name: string; teacher_name: string; rollcall_time: string; status: string; class_time_range: string }>;
};

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<ClassProfile | null>(null);

  useEffect(() => {
    getClassProfile(classId)
      .then((res) => {
        if (res.kind === "forbidden") {
          setState("forbidden");
          return;
        }
        setData(res.data as ClassProfile);
        setState("ready");
      })
      .catch((e: unknown) => {
        setState("error");
        setError(e instanceof Error ? e.message : "加载班级详情失败");
      });
  }, [classId]);

  if (state === "loading") return <LoadingState text="班级详情加载中..." />;
  if (state === "forbidden") return <ForbiddenState />;
  if (state === "error") return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{data.class.name}</h2>
            <Badge>{data.class.class_type}</Badge>
            <Badge variant={data.class.status === "开班中" ? "default" : "secondary"}>{data.class.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">课程：{data.class.course_name} ｜ 老师：{data.class.teacher_name} ｜ 学员：{data.class.student_count}/{data.class.capacity}</p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h3 className="font-medium">排课信息</h3>
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-muted/40"><th className="px-3 py-2 text-left">上课时间</th><th className="px-3 py-2 text-left">时间段</th><th className="px-3 py-2 text-left">老师</th><th className="px-3 py-2 text-left">状态</th></tr></thead><tbody>
            {data.schedules.map((x) => <tr key={x.id} className="border-t"><td className="px-3 py-2">{x.rollcall_time || "-"}</td><td className="px-3 py-2">{x.class_time_range || "-"}</td><td className="px-3 py-2">{x.teacher_name || "-"}</td><td className="px-3 py-2">{x.status || "-"}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">班级学员</h3>
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-muted/40"><th className="px-3 py-2 text-left">学员</th><th className="px-3 py-2 text-left">最近状态</th><th className="px-3 py-2 text-left">最近上课</th><th className="px-3 py-2 text-left">上课次数</th></tr></thead><tbody>
            {data.students.map((x) => <tr key={x.student_id} className="border-t"><td className="px-3 py-2">{x.student_name || "-"}</td><td className="px-3 py-2">{x.latest_status || "-"}</td><td className="px-3 py-2">{x.latest_time || "-"}</td><td className="px-3 py-2">{x.class_count}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">点名情况</h3>
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-muted/40"><th className="px-3 py-2 text-left">上课时间</th><th className="px-3 py-2 text-left">学员</th><th className="px-3 py-2 text-left">老师</th><th className="px-3 py-2 text-left">状态</th></tr></thead><tbody>
            {data.attendance.map((x) => <tr key={x.id} className="border-t"><td className="px-3 py-2">{x.rollcall_time || "-"}</td><td className="px-3 py-2">{x.student_name || "-"}</td><td className="px-3 py-2">{x.teacher_name || "-"}</td><td className="px-3 py-2">{x.status || "-"}</td></tr>)}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}
