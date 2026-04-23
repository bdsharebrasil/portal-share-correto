import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  abastecimento_galoes?: number | null;
}

interface ExportFuelRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: FuelRecord[];
  clientName: string;
  aircraftRegistration: string;
  onExportPDF: (month: number | null, year: string) => void;
}

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatDateBrazil(dateString: string, format: string = "dd/MM/yyyy"): string {
  if (!dateString) return "-";
  const date = new Date(dateString + "T00:00:00");
  if (isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return format.replace("dd", day).replace("MM", month).replace("yyyy", year.toString());
}

export function ExportFuelRecordsModal({
  open,
  onOpenChange,
  records,
  clientName,
  aircraftRegistration,
  onExportPDF,
}: ExportFuelRecordsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear] = useState<string>(currentYear);

  const filteredRecords = useMemo(() => {
    if (selectedMonth === "all") {
      return records;
    }
    const monthNum = parseInt(selectedMonth);
    return records.filter((r) => {
      const recordDate = new Date(r.data + "T00:00:00");
      return recordDate.getMonth() + 1 === monthNum && recordDate.getFullYear() === parseInt(selectedYear);
    });
  }, [records, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return {
      litros: filteredRecords.reduce((sum, r) => sum + r.litros, 0),
      valor: filteredRecords.reduce((sum, r) => sum + r.valor_total, 0),
    };
  }, [filteredRecords]);

  const handleExportClick = () => {
    const monthNum = selectedMonth === "all" ? null : parseInt(selectedMonth);
    onExportPDF(monthNum, selectedYear);
    onOpenChange(false);
  };

  const monthLabel = selectedMonth === "all" ? "Todos os meses" : MONTHS_PT[parseInt(selectedMonth) - 1];

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
          {/* Filtros */}
          <div className="grid grid-cols-2 gap-4 px-6">
            <div>
              <Label>Período</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MONTHS_PT.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month} / {selectedYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total de Registros</Label>
              <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 border border-border/50">
                <span className="font-semibold text-foreground">{filteredRecords.length}</span>
              </div>
            </div>
          </div>

          {/* Preview da Tabela */}
          <div className="px-6 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Preview do Relatório</span>
              <span className="text-xs text-muted-foreground">
                {monthLabel} / {selectedYear}
              </span>
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
                          <TableCell className="whitespace-nowrap text-xs">{record.partner_name || record.partner_name || "-"}</TableCell>
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
              <div className="bg-success/5 border border-success/20 rounded-lg p-3">
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
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold"
          >
            <Download className="h-4 w-4" />
            Salvar em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
