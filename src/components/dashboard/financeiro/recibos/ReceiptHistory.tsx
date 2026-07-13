import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { Receipt, Eye, Trash2, Pencil, Calendar, CalendarIcon, Trash } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate, GeneratedReceipt } from "@/lib/receiptUtils";

interface ReceiptHistoryProps {
  receipts: GeneratedReceipt[];
  onView: (receiptId: string) => Promise<void>;
  onDelete: (receiptId: string) => Promise<void>;
  onEdit?: (receiptId: string) => void | Promise<void>;
  onClearAll: () => Promise<void>;
  isLoading?: boolean;
}

export function ReceiptHistory({
  receipts,
  onView,
  onDelete,
  onEdit,
  onClearAll,
  isLoading = false,
}: ReceiptHistoryProps) {
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterStartDateOpen, setFilterStartDateOpen] = useState(false);
  const [filterEndDateOpen, setFilterEndDateOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const getFilteredReceipts = (): GeneratedReceipt[] => {
    if (!filterStartDate && !filterEndDate) {
      return receipts;
    }

    return receipts.filter((receipt) => {
      if (filterStartDate && receipt.issue_date < filterStartDate) return false;
      if (filterEndDate && receipt.issue_date > filterEndDate) return false;
      return true;
    });
  };

  const handleViewReceipt = async (receiptId: string) => {
    setViewingId(receiptId);
    try {
      await onView(receiptId);
    } finally {
      setViewingId(null);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm("Deseja excluir este recibo? Esta ação não pode ser desfeita.")) {
      return;
    }

    setDeletingId(receiptId);
    try {
      await onDelete(receiptId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditReceipt = async (receiptId: string) => {
    setEditingId(receiptId);
    try {
      if (onEdit) {
        await Promise.resolve(onEdit(receiptId));
      }
    } finally {
      setEditingId(null);
    }
  };

  const filteredReceipts = getFilteredReceipts();
  const hasFilters = filterStartDate || filterEndDate;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-2xl font-extrabold">Histórico de Recibos</CardTitle>
          {receipts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-7 px-2"
              title="Limpar todos os recibos"
            >
              <Trash className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        {receipts.length > 0 && (
          <div className="space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-100">
              <Calendar className="h-4 w-4" />
              Filtrar por Data
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Data Inicial</Label>
                <Popover open={filterStartDateOpen} onOpenChange={setFilterStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterStartDate
                        ? format((() => {
                            const [year, month, day] = filterStartDate.split('-').map(Number);
                            return new Date(year, month - 1, day);
                          })(), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UICalendar
                      mode="single"
                      selected={filterStartDate ? (() => {
                        const [year, month, day] = filterStartDate.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      })() : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          setFilterStartDate(`${year}-${month}-${day}`);
                          setFilterStartDateOpen(false);
                        }
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Data Final</Label>
                <Popover open={filterEndDateOpen} onOpenChange={setFilterEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterEndDate
                        ? format((() => {
                            const [year, month, day] = filterEndDate.split('-').map(Number);
                            return new Date(year, month - 1, day);
                          })(), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UICalendar
                      mode="single"
                      selected={filterEndDate ? (() => {
                        const [year, month, day] = filterEndDate.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      })() : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          setFilterEndDate(`${year}-${month}-${day}`);
                          setFilterEndDateOpen(false);
                        }
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {hasFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        )}

        {/* Lista de Recibos */}
        {receipts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum recibo emitido ainda</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum recibo encontrado para o período selecionado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className={`flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer ${
                  selectedReceiptId === receipt.id
                    ? "border-blue-500 border-2 bg-blue-500/5"
                    : "border-slate-600"
                }`}
                onClick={() => setSelectedReceiptId(selectedReceiptId === receipt.id ? null : receipt.id)}
              >
                <div>
                  <div className="font-semibold text-white">{receipt.payer_name}</div>
                  <div className="text-sm text-slate-400">
                    {formatDate(receipt.issue_date)} • {formatCurrency(receipt.valor)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{receipt.receipt_number}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewReceipt(receipt.id)}
                    title="Visualizar recibo"
                    disabled={viewingId === receipt.id || isLoading}
                  >
                    {viewingId === receipt.id ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditReceipt(receipt.id)}
                    title="Editar número e descrição"
                    className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg"
                    disabled={editingId === receipt.id || isLoading}
                  >
                    {editingId === receipt.id ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteReceipt(receipt.id)}
                    title="Excluir recibo"
                    className="text-red-600 hover:text-red-700"
                    disabled={deletingId === receipt.id || isLoading}
                  >
                    {deletingId === receipt.id ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
