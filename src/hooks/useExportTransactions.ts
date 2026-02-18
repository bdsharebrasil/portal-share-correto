import { useCallback } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export interface TransactionForExport {
  id: string;
  data: string;
  tipo_movimento: string;
  descricao: string;
  valor: number;
  status: string;
  categoria_nome?: string;
  cliente_nome?: string;
  conta_banco?: string;
  metodo_pagamento?: string;
  numero_documento?: string;
  [key: string]: any;
}

export function useExportTransactions() {
  const exportToCSV = useCallback(
    (transactions: TransactionForExport[], filename?: string) => {
      try {
        if (transactions.length === 0) {
          toast.error("Nenhuma transação para exportar");
          return;
        }

        // Prepare data
        const data = transactions.map((t) => ({
          Data: t.data,
          Tipo: t.tipo_movimento,
          Descrição: t.descricao,
          Valor: t.valor,
          Status: t.status,
          Categoria: t.categoria_nome || "-",
          Cliente: t.cliente_nome || "-",
          Conta: t.conta_banco || "-",
          "Método de Pagamento": t.metodo_pagamento || "-",
          "Nº Documento": t.numero_documento || "-",
        }));

        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Set column widths
        worksheet["!cols"] = [
          { wch: 12 },
          { wch: 10 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 15 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Transações");

        // Write file
        const filenameWithDate =
          filename ||
          `transacoes_${new Date().toISOString().split("T")[0]}.xlsx`;
        XLSX.writeFile(workbook, filenameWithDate);

        toast.success(
          `${transactions.length} transação(ões) exportada(s) com sucesso!`
        );
      } catch (error) {
        console.error("Export error:", error);
        toast.error("Erro ao exportar transações");
      }
    },
    []
  );

  const exportToCSVPlain = useCallback(
    (transactions: TransactionForExport[], filename?: string) => {
      try {
        if (transactions.length === 0) {
          toast.error("Nenhuma transação para exportar");
          return;
        }

        // Prepare CSV content
        const headers = [
          "Data",
          "Tipo",
          "Descrição",
          "Valor",
          "Status",
          "Categoria",
          "Cliente",
          "Conta",
          "Método de Pagamento",
          "Nº Documento",
        ];

        const rows = transactions.map((t) => [
          t.data,
          t.tipo_movimento,
          `"${t.descricao}"`,
          t.valor.toString().replace(".", ","),
          t.status,
          t.categoria_nome || "-",
          t.cliente_nome || "-",
          t.conta_banco || "-",
          t.metodo_pagamento || "-",
          t.numero_documento || "-",
        ]);

        const csv = [
          headers.join(";"),
          ...rows.map((row) => row.join(";")),
        ].join("\n");

        // Create blob and download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          filename || `transacoes_${new Date().toISOString().split("T")[0]}.csv`
        );
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success(
          `${transactions.length} transação(ões) exportada(s) com sucesso!`
        );
      } catch (error) {
        console.error("CSV export error:", error);
        toast.error("Erro ao exportar transações");
      }
    },
    []
  );

  return {
    exportToCSV,
    exportToCSVPlain,
  };
}
