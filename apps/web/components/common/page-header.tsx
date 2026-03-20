import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
