import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveFuelRecordPartnerName } from "./fuelRecordsUtils";

interface FuelRecord {
  id: string;
  data: string;
  trecho: string | null;
  local: string | null;
  comanda: string;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  partner_name?: string | null;
  nome_socio?: string | null;
  socio_nome?: string | null;
  abastecimento_galoes?: number | null;
}

interface ExportFuelRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: FuelRecord[];
  clientName: string;
  aircraftRegistration: string;
  // month: null = todos os meses do ano selecionado. dateFrom/dateTo (yyyy-MM-dd) usados quando periodMode === "range".
  onExportPDF: (month: number | null, year: string, dateFrom?: string | null, dateTo?: string | null) => void;
}

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Parser seguro de data. As datas em `abastecimentos.data` são salvas como
 * timestamp ISO completo (ex: "2026-08-09T03:00:00.000Z"), então NÃO se pode
 * concatenar "T00:00:00" nelas (gera uma string inválida e Invalid Date).
 * Esta função extrai apenas a parte "yyyy-MM-dd" e monta a data local.
 */
function parseDateSafe(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null;
  const datePart = dateValue.split("T")[0];
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateBrazil(dateValue: string | null | undefined, format: string = "dd/MM/yyyy"): string {
  const date = parseDateSafe(dateValue);
  if (!date) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return format.replace("dd", day).replace("MM", month).replace("yyyy", year.toString());
}

type PeriodMode = "month" | "range";

export function ExportFuelRecordsModal({
  open,
  onOpenChange,
  records,
  clientName,
  aircraftRegistration,
  onExportPDF,
}: ExportFuelRecordsModalProps) {
  const currentYear = new Date().getFullYear().toString();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const yearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => (nowYear - i).toString());
  }, []);

  const filteredRecords = useMemo(() => {
    if (periodMode === "range") {
      if (!dateFrom && !dateTo) return records;
      const from = dateFrom ? parseDateSafe(dateFrom) : null;
      const to = dateTo ? parseDateSafe(dateTo) : null;
      return records.filter((r) => {
        const recordDate = parseDateSafe(r.data);
        if (!recordDate) return false;
        if (from && recordDate < from) return false;
        if (to && recordDate > to) return false;
        return true;
      });
    }

    // periodMode === "month"
    return records.filter((r) => {
      const recordDate = parseDateSafe(r.data);
      if (!recordDate) return false;
      if (recordDate.getFullYear().toString() !== selectedYear) return false;
      if (selectedMonth === "all") return true;
      return recordDate.getMonth() + 1 === parseInt(selectedMonth);
    });
  }, [records, periodMode, selectedMonth, selectedYear, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return {
      litros: filteredRecords.reduce((sum, r) => sum + r.litros, 0),
      valor: filteredRecords.reduce((sum, r) => sum + r.valor_total, 0),
    };
  }, [filteredRecords]);

  const handleExportClick = () => {
    if (periodMode === "range") {
      onExportPDF(null, selectedYear, dateFrom || null, dateTo || null);
    } else {
      const monthNum = selectedMonth === "all" ? null : parseInt(selectedMonth);
      onExportPDF(monthNum, selectedYear, null, null);
    }
    onOpenChange(false);
  };

  const periodLabel =
    periodMode === "range"
      ? dateFrom || dateTo
        ? `${dateFrom ? formatDateBrazil(dateFrom) : "início"} até ${dateTo ? formatDateBrazil(dateTo) : "hoje"}`
        : "Todo o período"
      : selectedMonth === "all"
      ? `Ano de ${selectedYear}`
      : `${MONTHS_PT[parseInt(selectedMonth) - 1]} / ${selectedYear}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Exportar Registros de Combustível</DialogTitle>
              <DialogDescription className="mt-1">
                {clientName} • {aircraftRegistration}
              </DialogDescription>
            </div>
            <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Modo de período */}
          <div className="px-6 flex gap-2">
            <button
              type="button"
              onClick={() => setPeriodMode("month")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                periodMode === "month"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted/50"
              }`}
            >
              Mês / Ano
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("range")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                periodMode === "range"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted/50"
              }`}
            >
              Período Personalizado
            </button>
          </div>

          {/* Filtros */}
          {periodMode === "month" ? (
            <div className="grid grid-cols-2 gap-4 px-6">
              <div>
                <Label>Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {MONTHS_PT.map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 px-6">
              <div>
                <Label>De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div className="px-6">
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 border border-border/50">
              <span className="text-xs text-muted-foreground">Total de Registros no Período</span>
              <span className="font-semibold text-foreground">{filteredRecords.length}</span>
            </div>
          </div>

          {/* Preview da Tabela */}
          <div className="px-6 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Preview do Relatório</span>
              <span className="text-xs text-muted-foreground">{periodLabel}</span>
            </div>
            <ScrollArea className="flex-1 border border-border/50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow className="border-b border-border/50 hover:bg-transparent">
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Data</TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Trecho</TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Local</TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Comanda</TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">Sócio</TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">Litros</TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">Valor Litro</TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">Valor Total</TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">Galões</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                          <TableCell className="whitespace-nowrap text-xs">{formatDateBrazil(record.data)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{record.trecho || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{record.local || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{record.comanda || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{resolveFuelRecordPartnerName(record) || "-"}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-xs">{record.litros.toFixed(2)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-xs">R$ {record.valor_unitario.toFixed(2)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-xs font-semibold text-primary">
                            R$ {record.valor_total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-xs">
                            {record.abastecimento_galoes?.toFixed(2) || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                          Nenhum registro encontrado para o período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          {/* Totais */}
          {filteredRecords.length > 0 && (
            <div className="px-6 grid grid-cols-3 gap-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total de Litros</p>
                <p className="text-lg font-bold text-foreground">{totals.litros.toFixed(2)} L</p>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-foreground">R$ {totals.valor.toFixed(2)}</p>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Registros</p>
                <p className="text-lg font-bold text-foreground">{filteredRecords.length}</p>
              </div>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-2 px-6 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExportClick}
            disabled={filteredRecords.length === 0}
            variant="outline"
            className="gap-2 border-border/60 bg-slate-900/60 text-slate-200 font-medium hover:bg-slate-900 hover:text-white hover:border-slate-600 shadow-sm"
          >
            <Download className="h-4 w-4" />
            Salvar em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
