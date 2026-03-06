import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Eye, Maximize2, Filter } from "lucide-react";
import { toast } from "sonner";
import { useMonthlyPartnerReport } from "@/hooks/useMonthlyPartnerReport";
import { MonthlyPartnerReportPDF, type ReportFilter } from "./MonthlyPartnerReportPDF";
import { generatePartnerMonthlyPDF } from "@/components/utils/generatePartnerReport";
import { ReportFullPagePreview } from "./ReportFullPagePreview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  defaultMonth: string;
}

export function ExportReportModal({ open, onOpenChange, clientId, clientName, defaultMonth }: Props) {
  const [month, setMonth] = useState(defaultMonth);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeFlights, setIncludeFlights] = useState(true);
  const [includeFuels, setIncludeFuels] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showFullPage, setShowFullPage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("todos");

  const { data: reportData, isLoading } = useMonthlyPartnerReport(clientId, month);

  const togglePartner = (id: string) => {
    setSelectedPartners((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    if (!reportData) return;
    try {
      setIsExporting(true);
      setShowPreview(true);
      await new Promise((r) => setTimeout(r, 1000));
      await generatePartnerMonthlyPDF({
        elementId: "partner-report-pdf-content",
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

  if (showFullPage && reportData) {
    return (
      <ReportFullPagePreview
        data={reportData}
        month={month}
        clientName={clientName}
        includeCharts={includeCharts}
        includeFlights={includeFlights}
        includeFuels={includeFuels}
        includeExpenses={includeExpenses}
        selectedPartnerIds={selectedPartners}
        onClose={() => setShowFullPage(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileDown className="w-5 h-5 text-primary" />
            Exportar Relatório Completo por Sócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Mês do Relatório</Label>
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Incluir no Relatório</Label>
                <div className="space-y-2">
                  {[
                    { label: "Gráficos", checked: includeCharts, set: setIncludeCharts },
                    { label: "Voos", checked: includeFlights, set: setIncludeFlights },
                    { label: "Abastecimentos", checked: includeFuels, set: setIncludeFuels },
                    { label: "Despesas", checked: includeExpenses, set: setIncludeExpenses },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(c) => item.set(!!c)}
                        id={`chk-${item.label}`}
                      />
                      <Label htmlFor={`chk-${item.label}`} className="text-sm cursor-pointer">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Sócios (vazio = todos)</Label>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {reportData?.partners.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedPartners.includes(p.id)}
                        onCheckedChange={() => togglePartner(p.id)}
                        id={`partner-${p.id}`}
                      />
                      <Label htmlFor={`partner-${p.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                        {p.name}
                        <Badge variant="secondary" className="text-[10px]">
                          {p.share_percentage?.toFixed(1) || 0}%
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtro de Visualização
              </Label>
              <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ReportFilter)}>
                <SelectTrigger>
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
              <p className="text-[11px] text-muted-foreground">
                O filtro define quais seções aparecem no relatório e no PDF exportado.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Ocultar Preview" : "Preview Rápido"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullPage(true)}
              className="gap-2"
              disabled={!reportData}
            >
              <Maximize2 className="h-4 w-4" />
              Visualizar Relatório Completo
            </Button>
          </div>

          {/* Inline Preview */}
          {showPreview && reportData && (
            <div className="border border-border rounded-lg overflow-auto max-h-[500px] bg-white">
              <div id="partner-report-pdf-content">
                <MonthlyPartnerReportPDF
                  data={reportData}
                  month={month}
                  includeCharts={includeCharts}
                  includeFlights={includeFlights}
                  includeFuels={includeFuels}
                  includeExpenses={includeExpenses}
                  selectedPartnerIds={selectedPartners}
                  activeFilter={activeFilter}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || isLoading || !reportData} className="gap-2">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
