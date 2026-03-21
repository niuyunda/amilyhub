"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/common/data-table";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Pager } from "@/components/common/pager";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCourse, deleteCourse, getCourses, updateCourse } from "@/src/services/core-service";
import type { CourseItem } from "@/src/types/domain";

const PAGE_SIZE = 10;

type PriceRow = { name: string; quantity: number; totalPrice: number };

const parsePricingRules = (text: string): PriceRow[] => {
  const lines = String(text || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const out: PriceRow[] = [];
  for (const line of lines) {
    const m1 = line.match(/^(.*)\((\d+(?:\.\d+)?)元\/(?:课时)\)$/);
    if (m1) {
      out.push({ name: m1[1], quantity: 1, totalPrice: Number(m1[2]) });
      continue;
    }
    const m2 = line.match(/^(.*)\((\d+(?:\.\d+)?)元(\d+(?:\.\d+)?)课时\)$/);
    if (m2) {
      out.push({ name: m2[1], quantity: Number(m2[3]), totalPrice: Number(m2[2]) });
    }
  }
  return out;
};

const toPricingRulesText = (rows: PriceRow[]): string =>
  rows
    .filter((x) => x.name.trim())
    .map((x) => {
      if (x.quantity === 1) return `${x.name}(${x.totalPrice}元/课时)`;
      return `${x.name}(${x.totalPrice}元${x.quantity}课时)`;
    })
    .join("\n") || "-";

export default function CoursesPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<CourseItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [courseType, setCourseType] = useState("all");
  const [courseStatus, setCourseStatus] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCourseType, setFormCourseType] = useState<"一对一" | "一对多">("一对多");
  const [formStatus, setFormStatus] = useState<"启用" | "停用">("启用");
  const [formValidityDays, setFormValidityDays] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaterials, setFormMaterials] = useState("");
  const [pricingRows, setPricingRows] = useState<PriceRow[]>([{ name: "单价", quantity: 1, totalPrice: 130 }]);

  const load = useCallback(async (nextPage: number) => {
    setStatus("loading");
    const r = await getCourses({
      page: nextPage,
      pageSize: PAGE_SIZE,
      keyword: keyword || undefined,
      courseType: courseType === "all" ? undefined : (courseType as "一对一" | "一对多"),
      status: courseStatus === "all" ? undefined : (courseStatus as "启用" | "停用"),
    });
    if (r.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    setRows(r.data.items);
    setPage(r.data.page);
    setTotal(r.data.total);
    setStatus("ready");
  }, [keyword, courseType, courseStatus]);

  useEffect(() => {
    load(1).catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "课程管理加载失败");
    });
  }, [load]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingId(null);
    setFormName("");
    setFormCourseType("一对多");
    setFormStatus("启用");
    setFormValidityDays("");
    setFormDescription("");
    setFormMaterials("");
    setPricingRows([{ name: "单价", quantity: 1, totalPrice: 130 }]);
    setFormOpen(true);
  };

  const openEditForm = (row: CourseItem) => {
    setFormMode("edit");
    setEditingId(row.id);
    setFormName(row.courseName);
    setFormCourseType(row.courseType);
    setFormStatus(row.status);
    setFormValidityDays(row.validityDays != null ? String(row.validityDays) : "");
    setFormDescription(row.description ?? "");
    setFormMaterials(Array.isArray(row.materials) ? row.materials.join(", ") : "");
    const parsed = row.pricingItems?.length ? row.pricingItems : parsePricingRules(row.pricingRules || "");
    setPricingRows(parsed.length ? parsed : [{ name: "单价", quantity: 1, totalPrice: 130 }]);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!formName.trim()) return;
    const items = pricingRows.filter((x) => x.name.trim()).slice(0, 10);
    const pricingRules = toPricingRulesText(items);
    const materials = formMaterials.trim() ? formMaterials.split(",").map((m) => m.trim()).filter(Boolean) : undefined;
    const validityDays = formValidityDays ? Math.max(0, Number(formValidityDays)) : undefined;

    if (formMode === "create") {
      await createCourse({
        name: formName.trim(),
        courseType: formCourseType,
        feeType: "按课时",
        status: formStatus,
        pricingRules,
        pricingItems: items,
        studentNum: 0,
        validityDays,
        description: formDescription.trim() || undefined,
        materials,
      });
      setFormOpen(false);
      void load(1);
      return;
    }

    if (!editingId) return;
    await updateCourse(editingId, {
      name: formName.trim(),
      courseType: formCourseType,
      feeType: "按课时",
      status: formStatus,
      pricingRules,
      pricingItems: items,
      studentNum: 0,
      validityDays,
      description: formDescription.trim() || undefined,
      materials,
    });
    setFormOpen(false);
    void load(page);
  };

  const onDelete = async (row: CourseItem) => {
    if (!window.confirm(`确认删除课程：${row.courseName}？`)) return;
    await deleteCourse(row.id);
    void load(page);
  };

  const columns = useMemo<Array<ColumnDef<CourseItem>>>(() => [
    { key: "courseName", title: "课程名称" },
    { key: "courseType", title: "类型" },
    { key: "chargeType", title: "收费方式" },
    { key: "pricingRules", title: "定价标准", render: (row) => <pre className="whitespace-pre-wrap text-xs leading-5">{row.pricingRules}</pre> },
    { key: "validityDays", title: "有效期(天)" },
    { key: "description", title: "简介", render: (row) => <span className="text-xs">{row.description ?? "-"}</span> },
    { key: "materials", title: "教材", render: (row) => Array.isArray(row.materials) && row.materials.length ? <span className="text-xs">{row.materials.join(", ")}</span> : <span className="text-xs text-muted-foreground">-</span> },
    { key: "activeStudents", title: "在读学员数" },
    { key: "status", title: "启用状态" },
    {
      key: "id",
      title: "操作",
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditForm(row); }}>编辑</Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); void onDelete(row); }}>删除</Button>
        </div>
      ),
    },
  ], [page]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">课程管理</h2>
            <p className="text-sm text-muted-foreground">参考小麦助教：搜索课程、按类型/状态筛选、查看定价标准与在读学员数。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input className="max-w-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="请输入课程名称" />
            <Select value={courseType} onValueChange={setCourseType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="一对多">一对多</SelectItem>
                <SelectItem value="一对一">一对一</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseStatus} onValueChange={setCourseStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="启用">启用</SelectItem>
                <SelectItem value="停用">停用</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void load(1)}>查询</Button>
            <Button variant="outline" onClick={() => { setKeyword(""); setCourseType("all"); setCourseStatus("all"); void load(1); }}>重置</Button>
            <Button onClick={openCreateForm}>新建课程</Button>
          </div>
        </CardContent>
      </Card>

      {status === "loading" ? <LoadingState text="课程数据加载中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load(page)} /> : null}
      {status === "forbidden" ? <ForbiddenState /> : null}

      {status === "ready" ? (
        <>
          <DataTable rows={rows} columns={columns} />
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPrev={() => void load(page - 1)} onNext={() => void load(page + 1)} />
        </>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "新建课程" : "编辑课程"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">课程名称</p>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="请输入课程名称" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">课程类型</p>
                <Select value={formCourseType} onValueChange={(v) => setFormCourseType(v as "一对一" | "一对多")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="一对多">一对多</SelectItem>
                    <SelectItem value="一对一">一对一</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">状态</p>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as "启用" | "停用")}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="启用">启用</SelectItem>
                  <SelectItem value="停用">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">有效期（天）</p>
              <Input type="number" min="0" value={formValidityDays} onChange={(e) => setFormValidityDays(e.target.value)} placeholder="课程有效期天数（可选）" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">课程简介</p>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="课程简介（可选）" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">教材（多个用逗号分隔）</p>
              <Input value={formMaterials} onChange={(e) => setFormMaterials(e.target.value)} placeholder="教材名称，多个用逗号分隔（可选）" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">定价标准</p>
              <div className="rounded border">
                <div className="grid grid-cols-12 gap-2 border-b bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
                  <div className="col-span-4">名称</div>
                  <div className="col-span-2">数量(课时)</div>
                  <div className="col-span-2">总价(元)</div>
                  <div className="col-span-2">单价(元/课时)</div>
                  <div className="col-span-2">操作</div>
                </div>
                <div className="space-y-2 p-2">
                  {pricingRows.map((r, idx) => {
                    const unit = r.quantity > 0 ? r.totalPrice / r.quantity : 0;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-4" value={r.name} onChange={(e) => setPricingRows((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                        <Input className="col-span-2" type="number" value={r.quantity} onChange={(e) => setPricingRows((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value || 0) } : x))} />
                        <Input className="col-span-2" type="number" value={r.totalPrice} onChange={(e) => setPricingRows((prev) => prev.map((x, i) => i === idx ? { ...x, totalPrice: Number(e.target.value || 0) } : x))} />
                        <div className="col-span-2 text-sm">{Number.isFinite(unit) ? unit.toFixed(2) : "0.00"}</div>
                        <div className="col-span-2">
                          <Button variant="ghost" size="sm" onClick={() => setPricingRows((prev) => prev.filter((_, i) => i !== idx))}>删除</Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPricingRows((prev) => (prev.length >= 10 ? prev : [...prev, { name: "", quantity: 1, totalPrice: 0 }]))}
                  >
                    添加({pricingRows.length}/10)
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
            <Button onClick={() => void submitForm()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
