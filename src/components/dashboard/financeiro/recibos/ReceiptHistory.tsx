import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { 
  Receipt, Eye, Trash2, Pencil, Calendar, CalendarIcon, 
  Trash, Search, ArrowLeft 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate, GeneratedReceipt } from "@/lib/receiptUtils";
import { EnviarEmailClienteButton } from "@/components/dashboard/financeiro/EnviarEmailClienteButton";

// --- NOVO COMPONENTE DE PASTA 3D ANIMADA ---
interface FolderProps {
  name: string;
  itemCount: number;
}

function Folder({ name, itemCount }: FolderProps) {
  return (
    <section className="relative group flex flex-col items-center justify-center w-full h-full scale-[0.6] sm:scale-[0.7] md:scale-90 lg:scale-95 origin-top pt-6 pb-8">
      <div className="file relative w-52 h-36 cursor-pointer origin-bottom [perspective:1500px] z-50">
        {/* Capa Traseira e Aba Superior */}
        <div className="work-5 bg-amber-600 w-full h-full origin-top rounded-2xl rounded-tl-none group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)] transition-all ease duration-300 relative after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-20 after:h-4 after:bg-amber-600 after:rounded-t-2xl before:absolute before:content-[''] before:-top-[15px] before:left-[75.5px] before:w-4 before:h-4 before:bg-amber-600 before:[clip-path:polygon(0_35%,0%_100%,50%_100%);]" />
        
        {/* Folhas Internas */}
        <div className="work-4 absolute inset-1 bg-zinc-100 rounded-2xl transition-all ease duration-300 origin-bottom select-none group-hover:[transform:rotateX(-20deg)] flex justify-center pt-6 shadow-sm">
          <span className="text-zinc-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            {itemCount} {itemCount === 1 ? 'Recibo' : 'Recibos'}
          </span>
        </div>
        <div className="work-3 absolute inset-1 bg-zinc-200 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-30deg)]" />
        <div className="work-2 absolute inset-1 bg-zinc-300 rounded-2xl transition-all ease duration-300 origin-bottom group-hover:[transform:rotateX(-38deg)]" />
        
        {/* Capa Frontal */}
        <div className="work-1 absolute bottom-0 bg-gradient-to-t from-amber-500 to-amber-400 w-full h-[136px] rounded-2xl rounded-tr-none after:absolute after:content-[''] after:bottom-[99%] after:right-0 after:w-[126px] after:h-[14px] after:bg-amber-400 after:rounded-t-2xl before:absolute before:content-[''] before:-top-[10px] before:right-[120px] before:size-3 before:bg-amber-400 before:[clip-path:polygon(100%_14%,50%_100%,100%_100%);] transition-all ease duration-300 origin-bottom flex items-center justify-center group-hover:shadow-[inset_0_20px_40px_#fbbf24,_inset_0_-20px_40px_#d97706] group-hover:[transform:rotateX(-46deg)_translateY(1px)]">
          {/* Badge mostrando quantidade na frente */}
          <div className="bg-white/30 backdrop-blur-md rounded-full px-4 py-1.5 shadow-sm mt-6">
            <span className="text-sm font-extrabold text-amber-950">{itemCount}</span>
          </div>
        </div>
      </div>
      
      {/* Nome do Mês/Pasta abaixo do desenho */}
      <p className="text-xl font-bold pt-8 text-muted-foreground capitalize group-hover:text-amber-400 transition-colors duration-300">
        {name}
      </p>
    </section>
  );
}

// --- COMPONENTE PRINCIPAL ---
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filterStartDateOpen, setFilterStartDateOpen] = useState(false);
  const [filterEndDateOpen, setFilterEndDateOpen] = useState(false);
  
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const getFilteredReceipts = (): GeneratedReceipt[] => {
    return receipts.filter((receipt) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm || 
        receipt.payer_name.toLowerCase().includes(searchLower) ||
        (receipt.receipt_number && receipt.receipt_number.toLowerCase().includes(searchLower));

      const matchesStartDate = !filterStartDate || receipt.issue_date >= filterStartDate;
      const matchesEndDate = !filterEndDate || receipt.issue_date <= filterEndDate;

      return matchesSearch && matchesStartDate && matchesEndDate;
    });
  };

  const filteredReceipts = getFilteredReceipts();

  const groupedReceipts = filteredReceipts.reduce((acc, receipt) => {
    const dateStr = receipt.issue_date || receipt.data_emissao || receipt.criado_em || receipt.created_at;
    if (!dateStr) {
      const key = "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(receipt);
      return acc;
    }
    const parts = String(dateStr).split('-');
    if (parts.length < 2) {
      const key = "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(receipt);
      return acc;
    }
    const [year, month] = parts;
    const key = `${year}-${month}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(receipt);
    return acc;
  }, {} as Record<string, GeneratedReceipt[]>);

  const folderKeys = Object.keys(groupedReceipts).sort((a, b) => b.localeCompare(a));

  const handleViewReceipt = async (receiptId: string) => {
    setViewingId(receiptId);
    try {
      await onView(receiptId);
    } finally {
      setViewingId(null);
    }
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!confirm("Deseja excluir este recibo? Esta ação não pode ser desfeita.")) return;
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
      if (onEdit) await Promise.resolve(onEdit(receiptId));
    } finally {
      setEditingId(null);
    }
  };

  const hasFilters = filterStartDate || filterEndDate || searchTerm;
  const receiptsInFolder = selectedFolder ? groupedReceipts[selectedFolder] || [] : [];

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
              <Trash className="h-3 w-3 mr-2" /> Limpar Tudo
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {receipts.length > 0 && (
          <div className="space-y-4 p-4 bg-card/50 rounded-lg border border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <Search className="h-4 w-4" />
              Busca e Filtros
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-1">
                <Label className="text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome ou Nº do recibo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-card-secondary border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Data Inicial</Label>
                <Popover open={filterStartDateOpen} onOpenChange={setFilterStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-card-secondary border-border text-foreground hover:bg-secondary">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterStartDate
                        ? format(new Date(`${filterStartDate}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UICalendar
                      mode="single"
                      selected={filterStartDate ? new Date(`${filterStartDate}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFilterStartDate(format(date, 'yyyy-MM-dd'));
                          setFilterStartDateOpen(false);
                        }
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Data Final</Label>
                <Popover open={filterEndDateOpen} onOpenChange={setFilterEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-card-secondary border-border text-foreground hover:bg-secondary">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterEndDate
                        ? format(new Date(`${filterEndDate}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UICalendar
                      mode="single"
                      selected={filterEndDate ? new Date(`${filterEndDate}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFilterEndDate(format(date, 'yyyy-MM-dd'));
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
                  setSearchTerm("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setSelectedFolder(null);
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        )}

        {receipts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum recibo emitido ainda</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum recibo encontrado para a busca atual</p>
          </div>
        ) : !selectedFolder ? (
          /* VISÃO DE PASTAS */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-2">
            {folderKeys.map((key) => {
              if (key === "unknown") {
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedFolder(key)}
                    className="flex items-center justify-center w-full"
                  >
                    <Folder name={"Sem data"} itemCount={groupedReceipts[key].length} />
                  </div>
                );
              }
              const [year, month] = key.split('-');
              const folderDate = new Date(Number(year), Number(month) - 1, 1);
              const folderName = format(folderDate, "MMMM yyyy", { locale: ptBR });

              return (
                <div 
                  key={key} 
                  onClick={() => setSelectedFolder(key)}
                  className="flex items-center justify-center w-full"
                >
                  <Folder name={folderName} itemCount={groupedReceipts[key].length} />
                </div>
              );
            })}
          </div>
        ) : (
          /* VISÃO DE RECIBOS DENTRO DA PASTA */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-4 pb-2 border-b border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedFolder(null)}
                className="text-muted-foreground hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h3 className="text-lg font-bold text-amber-400 capitalize">
                {format(
                  new Date(Number(selectedFolder.split('-')[0]), Number(selectedFolder.split('-')[1]) - 1, 1), 
                  "MMMM yyyy", 
                  { locale: ptBR }
                )}
              </h3>
            </div>

            <div className="space-y-2">
              {receiptsInFolder.map((receipt) => (
                <div
                  key={receipt.id}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer ${
                    selectedReceiptId === receipt.id
                      ? "border-blue-500 border-2 bg-blue-500/5"
                      : "border-border bg-card-secondary/30"
                  }`}
                  onClick={() => setSelectedReceiptId(selectedReceiptId === receipt.id ? null : receipt.id)}
                >
                  <div>
                    <div className="font-semibold text-white">{receipt.payer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(receipt.issue_date)} • {formatCurrency(receipt.valor)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{receipt.receipt_number}</div>
                  </div>
                  <div className="flex gap-2">
                    <EnviarEmailClienteButton
                      stopPropagation
                      size="icon"
                      clienteId={receipt.cliente_id || null}
                      tipo="recibo"
                      referenceType="recibos"
                      referenceIds={[receipt.id]}
                      assuntoSugerido={`Recibo ${receipt.receipt_number || receipt.numero_recibo || ""}`}
                      mensagemSugerida={
                        `Olá${receipt.payer_name ? ` ${receipt.payer_name}` : ""},\n\n` +
                        `Segue o recibo ${receipt.receipt_number || receipt.numero_recibo || ""} no valor de ` +
                        `${formatCurrency(receipt.valor)}.\n\nAtenciosamente,\nEquipe Share Brasil`
                      }
                      anexos={
                        (receipt as any).pdf_url
                          ? [{ url: (receipt as any).pdf_url, label: `Recibo ${receipt.receipt_number || receipt.numero_recibo || ""}`, filename: "recibo.pdf" }]
                          : []
                      }
                      className="bg-sky-600/10 hover:bg-sky-600/20 text-sky-400 border-sky-600/20"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleViewReceipt(receipt.id); }}
                      title="Visualizar recibo"
                      disabled={viewingId === receipt.id || isLoading}
                    >
                      {viewingId === receipt.id ? <span className="animate-spin">⏳</span> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEditReceipt(receipt.id); }}
                      title="Editar recibo"
                      className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg border-amber-600/20"
                      disabled={editingId === receipt.id || isLoading}
                    >
                      {editingId === receipt.id ? <span className="animate-spin">⏳</span> : <Pencil className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteReceipt(receipt.id); }}
                      title="Excluir recibo"
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-900"
                      disabled={deletingId === receipt.id || isLoading}
                    >
                      {deletingId === receipt.id ? <span className="animate-spin">⏳</span> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}