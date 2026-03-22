"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { studentGateway } from "@/src/data/core/students";
import type { Student } from "@/src/types/domain";

const PAGE_SIZE = 10;

type StudentProfileLite = {
  courses: Array<{ course_name: string; order_state: string; order_no: string }>;
  consumption: Array<{ checked_at: string | null; course_name: string; consumed_lessons: number }>;
};

type StudentFormState = {
  name: string;
  phone: string;
  gender: "男" | "女";
  birthday: string;
  status: "在读" | "停课" | "结课";
  source: string;
  grade: string;
  school: string;
  tags: string;
  followUpPerson: string;
  eduManager: string;
};

const DEFAULT_FORM: StudentFormState = {
  name: "",
  phone: "",
  gender: "男",
  birthday: "",
  status: "在读",
  source: "",
  grade: "",
  school: "",
  tags: "",
  followUpPerson: "",
  eduManager: "",
};

function formatDateCn(value: string): string {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (token: number) => String(token).padStart(2, "0");
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`;
}

function normalizeBirthdayInput(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const replaced = text
    .replace("年", "-")
    .replace("月", "-")
    .replace("日", "")
    .replace(/\./g, "-")
    .replace(/\//g, "-");
  const date = new Date(replaced);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (token: number) => String(token).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function StudentsPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "在读" | "停课" | "结课">("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<StudentProfileLite | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enrollCourse, setEnrollCourse] = useState("");
  const [enrollAmount, setEnrollAmount] = useState("0");
  const [enrollCourses, setEnrollCourses] = useState<Array<{ id: string; name: string; pricingItems: Array<{ name: string; quantity: number; totalPrice: number }> }>>([]);
  const [enrollPriceName, setEnrollPriceName] = useState("");
  const [form, setForm] = useState<StudentFormState>(DEFAULT_FORM);
  const [statusStats, setStatusStats] = useState({ all: 0, active: 0, suspended: 0, ended: 0 });

  const loadStatusStats = useCallback(async (nextKeyword: string) => {
    const [allRes, activeRes, suspendedRes, endedRes] = await Promise.all([
      studentGateway.list({ page: 1, pageSize: 1, keyword: nextKeyword || undefined }),
      studentGateway.list({ page: 1, pageSize: 1, keyword: nextKeyword || undefined, status: "在读" }),
      studentGateway.list({ page: 1, pageSize: 1, keyword: nextKeyword || undefined, status: "停课" }),
      studentGateway.list({ page: 1, pageSize: 1, keyword: nextKeyword || undefined, status: "结课" }),
    ]);
    if (
      allRes.kind === "forbidden" ||
      activeRes.kind === "forbidden" ||
      suspendedRes.kind === "forbidden" ||
      endedRes.kind === "forbidden"
    ) {
      setStatus("forbidden");
      return;
    }
    setStatusStats({
      all: allRes.data.total,
      active: activeRes.data.total,
      suspended: suspendedRes.data.total,
      ended: endedRes.data.total,
    });
  }, []);

  const load = useCallback(
    async (
      nextPage: number,
      overrides?: { keyword?: string; statusFilter?: "all" | "在读" | "停课" | "结课"; source?: string; ageRange?: string },
    ) => {
      setStatus("loading");
      const nextKeyword = overrides?.keyword ?? keyword;
      const nextStatusFilter = overrides?.statusFilter ?? statusFilter;
      const nextSource = overrides?.source ?? source;
      const ageRange =
        overrides?.ageRange ?? (ageMin || ageMax ? `${ageMin || "0"}-${ageMax || "99"}` : undefined);
      const result = await studentGateway.list({
        page: nextPage,
        pageSize: PAGE_SIZE,
        keyword: nextKeyword || undefined,
        status: nextStatusFilter === "all" ? undefined : nextStatusFilter,
        source: nextSource || undefined,
        ageRange,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      setRows(result.data.items);
      setTotal(result.data.total);
      setPage(result.data.page);
      await loadStatusStats(nextKeyword);
      setStatus("ready");
    },
    [ageMax, ageMin, keyword, loadStatusStats, source, statusFilter],
  );

  useEffect(() => {
    load(1).catch((nextError: unknown) => {
      setStatus("error");
      setError(nextError instanceof Error ? nextError.message : "加载学员列表失败");
    });
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setSelectedProfile(null);
      return;
    }
    studentGateway
      .getProfile(selected.id)
      .then((result) => {
        if (result.kind === "ok") setSelectedProfile(result.data);
      })
      .catch(() => setSelectedProfile(null));
  }, [selected]);

  const columns: Array<ColumnDef<Student>> = useMemo(
    () => [
      {
        key: "name",
        title: "学员姓名",
        render: (row) => (
          <Link
            className="font-semibold text-foreground underline-offset-2 hover:underline"
            href={`/students/${encodeURIComponent(row.id)}`}
            onClick={(event) => event.stopPropagation()}
          >
            {row.name}
          </Link>
        ),
      },
      { key: "phone", title: "手机号" },
      { key: "className", title: "所在班级" },
      {
        key: "status",
        title: "状态",
        render: (row) => <Badge variant="outline">{row.status}</Badge>,
      },
      {
        key: "remainHours",
        title: "剩余课时",
        render: (row) => (row.remainHours != null ? `${row.remainHours} 课时` : "-"),
      },
      { key: "consultant", title: "跟进人" },
      { key: "source", title: "来源", render: (row) => row.source || "-" },
      { key: "grade", title: "年级", render: (row) => row.grade || "-" },
      { key: "school", title: "学校", render: (row) => row.school || "-" },
      {
        key: "tags",
        title: "标签",
        render: (row) => {
          const tags = row.tags ?? [];
          if (!tags.length) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag, index) => (
                <Badge key={`${row.id}-${tag}-${index}`} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 ? (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              ) : null}
            </div>
          );
        },
      },
      { key: "followUpPerson", title: "跟进人", render: (row) => row.followUpPerson || "-" },
      { key: "eduManager", title: "教务", render: (row) => row.eduManager || "-" },
      { key: "creator", title: "创建人" },
      { key: "createdAt", title: "创建时间", render: (row) => formatDateCn(row.createdAt) },
    ],
    [],
  );

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setCreateOpen(true);
  };

  const openEdit = () => {
    if (!selected) {
      toast.warning("请先点击一行学员");
      return;
    }
    setForm({
      name: selected.name,
      phone: selected.phone === "-" ? "" : selected.phone,
      gender: selected.gender,
      birthday: selected.birthday === "-" ? "" : selected.birthday,
      status: selected.status,
      source: selected.source ?? "",
      grade: selected.grade ?? "",
      school: selected.school ?? "",
      tags: Array.isArray(selected.tags) ? selected.tags.join(",") : "",
      followUpPerson: selected.followUpPerson ?? "",
      eduManager: selected.eduManager ?? "",
    });
    setEditOpen(true);
  };

  const onCreate = async () => {
    if (!form.name.trim()) {
      toast.warning("请填写学员姓名");
      return;
    }
    try {
      setSubmitting(true);
      const tags = form.tags
        ? form.tags
            .split(/[,，\s]+/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      const result = await studentGateway.create({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        gender: form.gender,
        birthday: normalizeBirthdayInput(form.birthday),
        source: form.source.trim() || undefined,
        grade: form.grade.trim() || undefined,
        school: form.school.trim() || undefined,
        tags: tags.length ? tags : undefined,
        followUpPerson: form.followUpPerson.trim() || undefined,
        eduManager: form.eduManager.trim() || undefined,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("学员创建成功");
      setCreateOpen(false);
      await load(1);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      const tags = form.tags
        ? form.tags
            .split(/[,，\s]+/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      const result = await studentGateway.update(selected.id, {
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        gender: form.gender,
        birthday: normalizeBirthdayInput(form.birthday),
        status: form.status,
        source: form.source.trim() || undefined,
        grade: form.grade.trim() || undefined,
        school: form.school.trim() || undefined,
        tags: tags.length ? tags : undefined,
        followUpPerson: form.followUpPerson.trim() || undefined,
        eduManager: form.eduManager.trim() || undefined,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("学员信息已更新");
      setEditOpen(false);
      await load(page);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openEnroll = async () => {
    if (!selected) {
      toast.warning("请先点击一行学员");
      return;
    }
    const courseRes = await studentGateway.getCourses({ page: 1, pageSize: 200 });
    if (courseRes.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setEnrollCourses(
      courseRes.data.items.map((course) => ({
        id: course.id,
        name: course.courseName,
        pricingItems: course.pricingItems ?? [],
      })),
    );
    setEnrollCourse("");
    setEnrollAmount("0");
    setEnrollPriceName("");
    setEnrollOpen(true);
  };

  const onEnroll = async () => {
    if (!selected || !enrollCourse) {
      toast.warning("请选择课程");
      return;
    }
    try {
      setSubmitting(true);
      const result = await studentGateway.enroll(selected.id, {
        courseName: enrollCourses.find((course) => course.id === enrollCourse)?.name ?? enrollCourse,
        receivableCents: Math.round(Number(enrollAmount || 0) * 100),
        receivedCents: Math.round(Number(enrollAmount || 0) * 100),
        arrearsCents: 0,
      });
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("报名成功");
      setEnrollOpen(false);
      await load(page);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "报名失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!selected) {
      toast.warning("请先选择学员");
      return;
    }
    try {
      setSubmitting(true);
      const result = await studentGateway.delete(selected.id, true);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      toast.success("学员已删除");
      setSelected(null);
      await load(1);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "删除失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="学员管理"
        description="查看学员信息、学习状态与最近课消情况。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openEdit}>
              编辑学员
            </Button>
            <Button variant="outline" onClick={() => void openEnroll()}>
              报名课程
            </Button>
            <Button onClick={openCreate}>新增学员</Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard title="全部学员" value={statusStats.all} />
        <StatusCard title="在读" value={statusStats.active} />
        <StatusCard title="停课" value={statusStats.suspended} />
        <StatusCard title="结课" value={statusStats.ended} />
      </section>

      <FilterBar
        onReset={() => {
          setKeyword("");
          setSource("");
          setAgeMin("");
          setAgeMax("");
          setStatusFilter("all");
          void load(1, { keyword: "", source: "", statusFilter: "all", ageRange: undefined });
        }}
        onQuery={() => void load(1)}
      >
        <FilterField label="关键词">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名 / 手机号" />
        </FilterField>
        <FilterField label="来源">
          <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="渠道来源" />
        </FilterField>
        <FilterField label="年龄范围">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input value={ageMin} onChange={(event) => setAgeMin(event.target.value)} placeholder="最小" />
            <span className="text-sm text-muted-foreground">-</span>
            <Input value={ageMax} onChange={(event) => setAgeMax(event.target.value)} placeholder="最大" />
          </div>
        </FilterField>
        <FilterField label="学员状态">
          <Select value={statusFilter} onValueChange={(value: "all" | "在读" | "停课" | "结课") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="在读">在读</SelectItem>
              <SelectItem value="停课">停课</SelectItem>
              <SelectItem value="结课">结课</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {status === "loading" ? <LoadingState text="学员列表加载中..." /> : null}
      {status === "error" ? <ErrorState message={error || "请求失败，请稍后重试"} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <DataTable rows={rows} columns={columns} onRowClick={setSelected} />
            </CardContent>
          </Card>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <DetailSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.name ?? "学员详情"}
        description={selected ? `${selected.className} · ${selected.phone}` : "查看学员信息"}
      >
        {selected ? (
          <>
            <DetailItem label="状态" value={selected.status} />
            <DetailItem label="生日" value={formatDateCn(selected.birthday)} />
            <DetailItem label="来源" value={selected.source ?? "-"} />
            <DetailItem label="学校" value={selected.school ?? "-"} />
            <DetailItem label="跟进人" value={selected.followUpPerson ?? "-"} />
            <DetailItem label="教务" value={selected.eduManager ?? "-"} />
            <DetailItem label="标签" value={(selected.tags ?? []).join(" / ") || "-"} />
            <DetailItem label="最近创建" value={selected.createdAt} />
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-sm font-medium">课程概览</p>
              {(selectedProfile?.courses ?? []).length ? (
                selectedProfile?.courses.map((course) => (
                  <div key={`${course.order_no}-${course.course_name}`} className="rounded-lg bg-muted/50 p-2 text-sm">
                    <p>{course.course_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.order_no} · {course.order_state}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无课程数据</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openEdit}>
                编辑
              </Button>
              <Button variant="outline" onClick={() => void openEnroll()}>
                报名课程
              </Button>
              <Button variant="destructive" onClick={() => void onDelete()} disabled={submitting}>
                删除
              </Button>
            </div>
          </>
        ) : null}
      </DetailSheet>

      <StudentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新增学员"
        description="录入基础信息后即可创建学员档案。"
        form={form}
        onFormChange={setForm}
        onSubmit={() => void onCreate()}
        submitting={submitting}
      />

      <StudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="编辑学员"
        description="更新学员基本资料和跟进信息。"
        form={form}
        onFormChange={setForm}
        onSubmit={() => void onEdit()}
        submitting={submitting}
      />

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>报名课程</DialogTitle>
            <DialogDescription>为学员选择课程与收费项。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FilterField label="课程">
              <Select value={enrollCourse} onValueChange={setEnrollCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="选择课程" />
                </SelectTrigger>
                <SelectContent>
                  {enrollCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="收费项名称">
              <Input value={enrollPriceName} onChange={(event) => setEnrollPriceName(event.target.value)} placeholder="例如：基础课包" />
            </FilterField>
            <FilterField label="金额">
              <Input value={enrollAmount} onChange={(event) => setEnrollAmount(event.target.value)} placeholder="0" />
            </FilterField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void onEnroll()} disabled={submitting}>
              确认报名
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function StudentDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  form: StudentFormState;
  onFormChange: (next: StudentFormState) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <InputField label="姓名" value={form.name} onChange={(value) => onFormChange({ ...form, name: value })} />
          <InputField label="手机号" value={form.phone} onChange={(value) => onFormChange({ ...form, phone: value })} />
          <SelectField
            label="性别"
            value={form.gender}
            onValueChange={(value) => onFormChange({ ...form, gender: value as "男" | "女" })}
            options={[
              { value: "男", label: "男" },
              { value: "女", label: "女" },
            ]}
          />
          <InputField label="生日" value={form.birthday} onChange={(value) => onFormChange({ ...form, birthday: value })} placeholder="YYYY-MM-DD" />
          <SelectField
            label="状态"
            value={form.status}
            onValueChange={(value) => onFormChange({ ...form, status: value as "在读" | "停课" | "结课" })}
            options={[
              { value: "在读", label: "在读" },
              { value: "停课", label: "停课" },
              { value: "结课", label: "结课" },
            ]}
          />
          <InputField label="来源" value={form.source} onChange={(value) => onFormChange({ ...form, source: value })} />
          <InputField label="年级" value={form.grade} onChange={(value) => onFormChange({ ...form, grade: value })} />
          <InputField label="学校" value={form.school} onChange={(value) => onFormChange({ ...form, school: value })} />
          <InputField label="标签" value={form.tags} onChange={(value) => onFormChange({ ...form, tags: value })} placeholder="逗号分隔" />
          <InputField label="跟进人" value={form.followUpPerson} onChange={(value) => onFormChange({ ...form, followUpPerson: value })} />
          <InputField label="教务" value={form.eduManager} onChange={(value) => onFormChange({ ...form, eduManager: value })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <FilterField label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </FilterField>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FilterField label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={`选择${label}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
