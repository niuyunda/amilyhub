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
    <Card className="border-border/75 bg-card/70 shadow-xs">
      <CardContent className="flex flex-wrap items-end justify-between gap-3 p-3.5 sm:p-4">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">{children}</div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" className="h-9 flex-1 sm:flex-none" onClick={onReset}>
            重置
          </Button>
          <Button className="h-9 flex-1 sm:flex-none" onClick={onQuery}>查询</Button>
        </div>
      </CardContent>
    </Card>
  );
}
