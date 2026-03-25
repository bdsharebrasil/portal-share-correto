import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Eye, Maximize2, Filter, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMultiMonthPartnerReport } from "@/hooks/useMultiMonthPartnerReport";
import { MonthlyPartnerReportPDF, type ReportFilter } from "./MonthlyPartnerReportPDF";
import { MultiMonthPartnerReportPDF } from "./MultiMonthPartnerReportPDF";
import { generatePartnerMonthlyPDF } from "@/components/utils/generatePartnerReport";
import { ReportFullPagePreview } from "./ReportFullPagePreview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  defaultMonth: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function ExportReportModal({ open, onOpenChange, clientId, clientName, defaultMonth }: Props) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([defaultMonth]);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeFlights, setIncludeFlights] = useState(true);
  const [includeFuels, setIncludeFuels] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showFullPage, setShowFullPage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("todos");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Parse month into year/monthIndex for the picker
  const [pickerYear, setPickerYear] = useState(() => parseInt(defaultMonth.split("-")[0]));

  // Load data for all selected months
  const { dataByMonth, isLoading } = useMultiMonthPartnerReport(clientId, selectedMonths);

  const togglePartner = (id: string) => {
    setSelectedPartners((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleMonth = (monthIdx: number) => {
    const m = `${pickerYear}-${String(monthIdx + 1).padStart(2, "0")}`;
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((month) => month !== m) : [...prev, m]
    );
  };

  const removeMonth = (month: string) => {
    setSelectedMonths((prev) => prev.filter((m) => m !== month));
  };

  const handleExport = async () => {
    if (selectedMonths.length === 0) {
      toast.error("Selecione pelo menos um mês");
      return;
    }
    if (dataByMonth.size === 0) {
      toast.error("Carregando dados...");
      return;
    }
    try {
      setIsExporting(true);
      setShowPreview(true);
      await new Promise((r) => setTimeout(r, 1000));
      await generatePartnerMonthlyPDF({
        elementId: "partner-report-pdf-content",
        clientName,
        months: selectedMonths,
      });
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Month labels for display
  const getMonthLabel = (month: string) => {
    const [year, mon] = month.split("-");
    const date = new Date(parseInt(year), parseInt(mon) - 1, 15);
    const label = format(date, "MMM/yy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  if (showFullPage && dataByMonth.size > 0) {
    const firstMonthData = dataByMonth.get(selectedMonths[0]);
    if (!firstMonthData) return null;

    return (
      <ReportFullPagePreview
        data={firstMonthData}
        month={selectedMonths[0]}
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileDown className="w-5 h-5 text-primary" />
            Exportar Relatório por Sócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Month Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meses do Relatório (selecione múltiplos)</Label>

            {/* Display selected months */}
            <div className="flex flex-wrap gap-2 min-h-[32px] p-2 border border-border rounded-md bg-muted/30">
              {selectedMonths.length === 0 ? (
                <span className="text-sm text-muted-foreground">Selecione pelo menos um mês</span>
              ) : (
                selectedMonths.map((month) => (
                  <Badge key={month} variant="secondary" className="gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    {getMonthLabel(month)}
                    <button
                      onClick={() => removeMonth(month)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Month picker popover */}
            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between text-left font-medium h-10"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Adicionar mês
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 pointer-events-auto" align="start">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPickerYear(y => y - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-sm">{pickerYear}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPickerYear(y => y + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTHS.map((name, idx) => {
                      const monthStr = `${pickerYear}-${String(idx + 1).padStart(2, "0")}`;
                      const isSelected = selectedMonths.includes(monthStr);
                      return (
                        <Button
                          key={idx}
                          variant={isSelected ? "default" : "ghost"}
                          size="sm"
                          className={`text-xs h-9 ${isSelected ? "" : "hover:bg-accent"}`}
                          onClick={() => toggleMonth(idx)}
                        >
                          {name.slice(0, 3)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Include options */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Incluir no Relatório</Label>
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

            {/* Partners */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sócios (vazio = todos)</Label>
              {isLoading || dataByMonth.size === 0 ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {dataByMonth.get(selectedMonths[0])?.partners.map((p) => (
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
          </div>

          {/* Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filtro de Visualização
            </Label>
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ReportFilter)}>
              <SelectTrigger className="h-10">
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

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
              disabled={dataByMonth.size === 0}
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Ocultar Preview" : "Preview Rápido"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullPage(true)}
              className="gap-2"
              disabled={dataByMonth.size === 0}
            >
              <Maximize2 className="h-4 w-4" />
              Visualizar Completo
            </Button>
          </div>

          {/* Inline Preview */}
          {showPreview && dataByMonth.size > 0 && (
            <div className="border border-border rounded-lg overflow-auto max-h-[500px] bg-white">
              <div id="partner-report-pdf-content">
                {selectedMonths.length === 1 ? (
                  <MonthlyPartnerReportPDF
                    data={dataByMonth.get(selectedMonths[0])!}
                    month={selectedMonths[0]}
                    includeCharts={includeCharts}
                    includeFlights={includeFlights}
                    includeFuels={includeFuels}
                    includeExpenses={includeExpenses}
                    selectedPartnerIds={selectedPartners}
                    activeFilter={activeFilter}
                  />
                ) : (
                  <MultiMonthPartnerReportPDF
                    dataByMonth={dataByMonth}
                    months={selectedMonths}
                    includeCharts={includeCharts}
                    includeFlights={includeFlights}
                    includeFuels={includeFuels}
                    includeExpenses={includeExpenses}
                    selectedPartnerIds={selectedPartners}
                    activeFilter={activeFilter}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || isLoading || dataByMonth.size === 0 || selectedMonths.length === 0} className="gap-2">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
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
