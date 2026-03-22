import type { ReactNode } from "react";

import { EmptyState } from "@/components/common/state-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={String(column.key)}>{column.title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={getRowKey ? getRowKey(row, index) : row.id}
              className={onRowClick ? "cursor-pointer" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <TableCell key={String(column.key)}>
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
