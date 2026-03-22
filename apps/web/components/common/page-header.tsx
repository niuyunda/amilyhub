import type { ReactNode } from "react";

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
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3.5 shadow-xs">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 self-center">{actions}</div> : null}
    </div>
  );
}
