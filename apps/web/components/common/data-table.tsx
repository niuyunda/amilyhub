import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/state-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColumnDef<T extends { id: string }> {
  key: keyof T | string;
  title: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  getRowKey,
}: {
  rows: T[];
  columns: Array<ColumnDef<T>>;
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/75 bg-card/80 p-6 shadow-xs">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/75 bg-card/80 shadow-xs">
      <Table>
        <TableHeader className="bg-muted/45">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)} className="h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/85">
                {column.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={getRowKey ? getRowKey(row, index) : row.id}
              className={cn(onRowClick ? "cursor-pointer" : "", "hover:bg-muted/35")}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <TableCell key={String(column.key)} className="px-3 py-3">
                  {column.render
                    ? column.render(row)
                    : String((row as Record<string, unknown>)[column.key as string] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
