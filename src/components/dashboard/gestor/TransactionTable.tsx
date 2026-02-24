import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TransactionTableProps {
  title: string;
  columns: Array<{
    key: string;
    label: string;
  }>;
  data: Array<Record<string, any>>;
  emptyMessage?: string;
  renderCell?: (column: string, value: any, row: any) => React.ReactNode;
}

export function TransactionTable({
  title,
  columns,
  data,
  emptyMessage = "Nenhum registro encontrado",
  renderCell,
}: TransactionTableProps) {
  return (
    <Card className="bg-card/80 border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-4">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="border-border">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4"
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((row, idx) => (
                  <TableRow key={idx} className="border-border hover:bg-muted/50">
                    {columns.map((column) => (
                      <TableCell
                        key={`${idx}-${column.key}`}
                        className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4"
                      >
                        {renderCell
                          ? renderCell(column.key, row[column.key], row)
                          : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
