"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteStudent, enrollStudent, getCourses, getOrders, getStudentProfile, updateStudent } from "@/src/services/core-service";
import type { CourseItem, Order } from "@/src/types/domain";

type ProfileData = {
  student: {
    source_student_id: string;
    name: string;
    phone: string;
    gender: string;
    birthday: string | null;
    status: string;
    source_created_at: string | null;
    class_name?: string;
    consultant?: string;
    source?: string | null;
    grade?: string | null;
    school?: string | null;
    tags?: string[];
    follow_up_person?: string | null;
    edu_manager?: string | null;
    wechat_bound?: boolean;
    face_captured?: boolean;
    age?: number | null;
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
    order_no: string;
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
  order_logs?: Array<{
    order_no: string;
    item_info: string;
    receivable_cents: number;
    received_cents: number;
    order_state: string;
    business_type: string;
    owner_name: string;
    created_at: string | null;
    paid_at: string | null;
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

function displayReceivable(receivableCents: number, receivedCents: number): number {
  return receivableCents > 0 ? receivableCents : receivedCents;
}

function formatTeacherNames(v?: string | null): string {
  if (!v) return "-";
  return String(v).replace(/[\[\]"]/g, "");
}

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);

  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("报读课程");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAllCourses, setShowAllCourses] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseItem[]>([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedPricing, setSelectedPricing] = useState("");
  const [amount, setAmount] = useState("0");

  const reload = async (loading = true) => {
    if (loading) setStatus("loading");
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
  };

  useEffect(() => {
    reload(true).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "学员详情加载失败");
    });
  }, [studentId]);

  const summary = useMemo(() => {
    const paidYuan = orders.reduce((sum, o) => sum + o.paidYuan, 0);
    const receivableYuan = orders.reduce((sum, o) => sum + (o.receivableYuan > 0 ? o.receivableYuan : o.paidYuan), 0);
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

  const visibleCourses = useMemo(() => {
    const rows = profile?.courses ?? [];
    return showAllCourses ? rows : rows.slice(0, 2);
  }, [profile, showAllCourses]);

  const changeStatus = async (next: "在读" | "停课" | "结课") => {
    if (!profile) return;
    await updateStudent(profile.student.source_student_id, { status: next });
    await reload(false);
  };

  const openEnrollDialog = async (mode: "报名" | "试听") => {
    const r = await getCourses({ page: 1, pageSize: 200 });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    const items = r.data.items;
    setCourseOptions(items);
    const first = items[0];
    const firstPrice = first?.pricingItems?.[0];
    setSelectedCourse(first?.courseName ?? "");
    setSelectedPricing(firstPrice?.name ?? "");
    setAmount(String(firstPrice?.totalPrice ?? 0));
    if (mode === "报名") setEnrollOpen(true);
    else setTrialOpen(true);
  };

  const selectedCourseObj = courseOptions.find((x) => x.courseName === selectedCourse);
  const pricingOptions = selectedCourseObj?.pricingItems ?? [];

  useEffect(() => {
    if (!selectedCourseObj) return;
    const first = selectedCourseObj.pricingItems?.[0];
    if (!first) return;
    setSelectedPricing(first.name);
    setAmount(String(first.totalPrice));
  }, [selectedCourse]);

  const submitOrder = async (mode: "报名" | "试听") => {
    if (!selectedCourse) {
      toast.warning("请选择课程");
      return;
    }
    const amt = Math.max(0, Number(amount || "0"));
    try {
      setSubmitting(true);
      await enrollStudent(studentId, {
        courseName: selectedCourse,
        receivableCents: Math.round(amt * 100),
        receivedCents: Math.round(amt * 100),
        arrearsCents: 0,
        orderType: mode,
      });
      toast.success(`${mode}已创建`);
      setEnrollOpen(false);
      setTrialOpen(false);
      await reload(false);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteStudent = async () => {
    if (!window.confirm("确认删除当前学员及关联记录？")) return;
    await deleteStudent(studentId, true);
    history.back();
  };

  return (
    <div className="space-y-5">
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
                <Button variant="outline" onClick={() => history.back()}>返回学员列表</Button>
                <Button size="sm" onClick={() => void openEnrollDialog("报名")}>报名</Button>
                <Button size="sm" variant="outline" onClick={() => void openEnrollDialog("试听")}>试听</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">更多操作</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => void changeStatus("在读")}>恢复在读</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void changeStatus("停课")}>停课</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void changeStatus("结课")}>结课</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void onDeleteStudent()}>删除学员</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4 lg:grid-cols-8">
              <Kpi label="来源" value={profile.student.source ?? "-"} />
              <Kpi label="年级" value={profile.student.grade ?? "-"} />
              <Kpi label="学校" value={profile.student.school ?? "-"} />
              <Kpi label="标签" value={Array.isArray(profile.student.tags) ? profile.student.tags.join(", ") || "-" : "-"} />
              <Kpi label="跟进人" value={profile.student.follow_up_person ?? "-"} />
              <Kpi label="教务" value={profile.student.edu_manager ?? "-"} />
              <Kpi label="微信绑定" value={profile.student.wechat_bound ? "是" : "否"} />
              <Kpi label="人脸采集" value={profile.student.face_captured ? "是" : "否"} />
            </div>
          </section>

          <section>
            <div className="inline-flex rounded-2xl bg-muted p-1">
              {TABS.map((item) => (
                <button
                  key={item}
                  className={`rounded-xl px-4 py-2 text-sm transition ${tab === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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
                    {visibleCourses.map((item, idx) => (
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
              {(profile.courses ?? []).length > 2 ? (
                <div className="border-t px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => setShowAllCourses((v) => !v)}>
                    {showAllCourses ? "收起" : "展开全部"}
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "消费记录" ? (
            <section className="overflow-hidden rounded-xl border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">消费记录（订单记录）</div>
              <div className="grid grid-cols-3 gap-3 border-b bg-muted/20 px-4 py-3 text-sm">
                <Kpi label="订单总金额(元)" value={summary.receivableYuan.toFixed(2)} />
                <Kpi label="实收金额(元)" value={summary.paidYuan.toFixed(2)} />
                <Kpi label="欠费金额(元)" value={summary.arrearsYuan.toFixed(2)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>购买项目</Th><Th>应收/应退(元)</Th><Th>实收/实退(元)</Th><Th>业绩归属人</Th><Th>创建时间</Th><Th>最近支付时间</Th><Th>订单状态</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.order_logs ?? []).map((item, idx) => (
                      <tr key={`${item.order_no}-${idx}`} className="border-t">
                        <Td>{item.item_info || "-"}</Td>
                        <Td>{centsToYuan(displayReceivable(item.receivable_cents, item.received_cents))}</Td>
                        <Td>{centsToYuan(item.received_cents)}</Td>
                        <Td>{item.owner_name || "-"}</Td>
                        <Td>{formatCnDateTime(item.created_at)}</Td>
                        <Td>{formatCnDateTime(item.paid_at)}</Td>
                        <Td>{item.order_state === "PAID" ? "已支付" : item.order_state}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!(profile.order_logs ?? []).length ? <div className="p-4 text-sm text-muted-foreground">暂无消费记录</div> : null}
            </section>
          ) : null}

          {tab === "上课记录" ? (
            <section className="overflow-hidden rounded-xl border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">上课记录</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <Th>上课时间</Th><Th>课程</Th><Th>班级</Th><Th>老师</Th><Th>消课数</Th><Th>关联订单</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.consumption ?? []).map((item) => (
                      <tr key={item.source_id} className="border-t">
                        <Td>{formatCnDateTime(item.checked_at)}</Td>
                        <Td>{item.course_name || "-"}</Td>
                        <Td>{item.class_name || "-"}</Td>
                        <Td>{formatTeacherNames(item.teacher_names)}</Td>
                        <Td>{item.consumed_lessons}</Td>
                        <Td>{item.order_no || "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!(profile.consumption ?? []).length ? <div className="p-4 text-sm text-muted-foreground">暂无上课记录</div> : null}
            </section>
          ) : null}

          <OrderDialog
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            title="学员报名"
            submitText="确认报名"
            selectedCourse={selectedCourse}
            setSelectedCourse={setSelectedCourse}
            selectedPricing={selectedPricing}
            setSelectedPricing={setSelectedPricing}
            amount={amount}
            setAmount={setAmount}
            courseOptions={courseOptions}
            pricingOptions={pricingOptions}
            onSubmit={() => void submitOrder("报名")}
            submitting={submitting}
          />

          <OrderDialog
            open={trialOpen}
            onOpenChange={setTrialOpen}
            title="创建试听"
            submitText="确认试听"
            selectedCourse={selectedCourse}
            setSelectedCourse={setSelectedCourse}
            selectedPricing={selectedPricing}
            setSelectedPricing={setSelectedPricing}
            amount={amount}
            setAmount={setAmount}
            courseOptions={courseOptions}
            pricingOptions={pricingOptions}
            onSubmit={() => void submitOrder("试听")}
            submitting={submitting}
          />
        </>
      ) : null}
    </div>
  );
}

function OrderDialog({
  open,
  onOpenChange,
  title,
  submitText,
  selectedCourse,
  setSelectedCourse,
  selectedPricing,
  setSelectedPricing,
  amount,
  setAmount,
  courseOptions,
  pricingOptions,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  submitText: string;
  selectedCourse: string;
  setSelectedCourse: (v: string) => void;
  selectedPricing: string;
  setSelectedPricing: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  courseOptions: CourseItem[];
  pricingOptions: Array<{ name: string; quantity: number; totalPrice: number }>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>按课程定价标准选择条目并自动带出金额。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Select value={selectedCourse || "__none"} onValueChange={(v) => v !== "__none" && setSelectedCourse(v)}>
            <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
            <SelectContent>
              {courseOptions.map((c) => <SelectItem key={c.id} value={c.courseName}>{c.courseName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={selectedPricing || "__none"}
            onValueChange={(v) => {
              if (v === "__none") return;
              setSelectedPricing(v);
              const p = pricingOptions.find((x) => x.name === v);
              if (p) setAmount(String(p.totalPrice));
            }}
          >
            <SelectTrigger><SelectValue placeholder="选择定价规则" /></SelectTrigger>
            <SelectContent>
              {pricingOptions.length
                ? pricingOptions.map((p, i) => <SelectItem key={`${p.name}-${i}`} value={p.name}>{p.name}（{p.totalPrice}元/{p.quantity}课时）</SelectItem>)
                : <SelectItem value="__none" disabled>无可用定价规则</SelectItem>}
            </SelectContent>
          </Select>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="金额（元）" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={submitting} onClick={onSubmit}>{submitting ? "提交中..." : submitText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
