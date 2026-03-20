import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FilterBar({
  children,
  onReset,
  onQuery,
}: {
  children: ReactNode;
  onReset: () => void;
  onQuery: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-4 md:grid-cols-2">{children}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            重置
          </Button>
          <Button onClick={onQuery}>查询</Button>
        </div>
      </CardContent>
    </Card>
  );
}
