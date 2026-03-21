"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { ErrorState, ForbiddenState, LoadingState } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { getRbacRoles, updateRbacRolePermissions } from "@/src/services/core-service";
import type { RbacRoleItem } from "@/src/types/domain";

export default function RbacPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<RbacRoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    const result = await getRbacRoles();
    if (result.kind === "forbidden") {
      setStatus("forbidden");
      return;
    }
    const list = result.data;
    setRows(list);
    const perms = Array.from(new Set(list.flatMap((x) => x.permissions))).sort();
    setAllPermissions(perms);
    setStatus("ready");
  }, []);

  useEffect(() => {
    load().catch((e: unknown) => {
      setStatus("error");
      setError(e instanceof Error ? e.message : "加载 RBAC 角色失败");
    });
  }, [load]);

  const canRenderPerms = useMemo(() => allPermissions.length > 0, [allPermissions]);

  async function handleSave(role: string, permissions: string[]) {
    setSavingRole(role);
    try {
      const result = await updateRbacRolePermissions(role, permissions);
      if (result.kind === "forbidden") {
        setStatus("forbidden");
        return;
      }
      setRows((prev) => prev.map((x) => (x.role === role ? result.data : x)));
    } finally {
      setSavingRole(null);
    }
  }

  function togglePermission(role: string, permission: string, checked: boolean) {
    setRows((prev) => prev.map((x) => {
      if (x.role !== role) return x;
      const next = checked ? Array.from(new Set([...x.permissions, permission])) : x.permissions.filter((p) => p !== permission);
      return { ...x, permissions: next.sort() };
    }));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="RBAC 权限管理" description="查看角色权限并进行最小可用维护。" />

      {status === "loading" ? <LoadingState text="加载角色权限中..." /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {status === "forbidden" ? <ForbiddenState message="无权限执行该操作" /> : null}

      {status === "ready" ? (
        <div className="space-y-4">
          {!canRenderPerms ? <div className="text-sm text-muted-foreground">暂无可配置权限点</div> : null}
          {rows.map((row) => (
            <div key={row.role} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">角色</div>
                  <div className="font-semibold">{row.role}</div>
                </div>
                <Button size="sm" onClick={() => void handleSave(row.role, row.permissions)} disabled={savingRole === row.role}>
                  {savingRole === row.role ? "保存中..." : "保存权限"}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {allPermissions.map((permission) => (
                  <label key={`${row.role}-${permission}`} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.permissions.includes(permission)}
                      onChange={(e) => togglePermission(row.role, permission, e.target.checked)}
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
