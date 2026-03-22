import type { ReactNode } from "react";

import { requireOperatorSession } from "@/src/features/auth/session";
import { OperatorShell } from "@/src/features/workspace/components/operator-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireOperatorSession();
  return <OperatorShell user={user}>{children}</OperatorShell>;
}
