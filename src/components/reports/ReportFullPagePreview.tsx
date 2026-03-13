import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, X, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import type { MonthlyReportData } from "@/hooks/useMonthlyPartnerReport";
import { MonthlyPartnerReportPDF, type ReportFilter } from "./MonthlyPartnerReportPDF";
import { generatePartnerMonthlyPDF } from "@/components/utils/generatePartnerReport";

interface Props {
  data: MonthlyReportData;
  month: string;
  clientName: string;
  includeCharts: boolean;
  includeFlights: boolean;
  includeFuels: boolean;
  includeExpenses: boolean;
  selectedPartnerIds: string[];
  onClose: () => void;
}

export function ReportFullPagePreview({
  data,
  month,
  clientName,
  includeCharts,
  includeFlights,
  includeFuels,
  includeExpenses,
  selectedPartnerIds,
  onClose,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("todos");

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await new Promise((r) => setTimeout(r, 500));
      await generatePartnerMonthlyPDF({
        elementId: "full-page-report-content",
        clientName,
        month,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-foreground">Relatório Mensal — {clientName}</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ReportFilter)}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os dados</SelectItem>
                <SelectItem value="voos">Somente Voos</SelectItem>
                <SelectItem value="abastecimentos">Somente Abastecimentos</SelectItem>
                <SelectItem value="despesas">Somente Despesas</SelectItem>
                <SelectItem value="viagens">Somente Viagens</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} disabled={isExporting} size="sm" className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {isExporting ? "Gerando..." : "Exportar PDF"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto bg-gray-200 p-8">
        <div className="max-w-[1100px] mx-auto shadow-2xl rounded-lg overflow-hidden">
          <div id="full-page-report-content">
            <MonthlyPartnerReportPDF
              data={data}
              month={month}
              includeCharts={includeCharts}
              includeFlights={includeFlights}
              includeFuels={includeFuels}
              includeExpenses={includeExpenses}
              selectedPartnerIds={selectedPartnerIds}
              activeFilter={activeFilter}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
