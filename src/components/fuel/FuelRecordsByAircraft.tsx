import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Download, Edit, Trash2, ChevronLeft, Plane, TrendingUp, FileUp, X, Eye, FileText, Image as ImageIcon, FileCheck, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModernFileUpload } from "@/components/ui/modern-file-upload";

interface Client {
  id: string;
  company_name: string;
}

interface Aircraft {
  id: string;
  registration: string;
  year: number | null;
}

interface FuelRecord {
  id: string;
  data: string;
  trecho: string | null;
  local: string | null;
  comanda: string;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  abastecimento_galoes: number | null;
  ano: string | null;
  comanda_url: string | null;
  nota_url: string | null;
  boleto_url: string | null;
  abastecedor?: string | null;
  status_pagamento?: string | null;
}

interface FuelSupplier {
  id: string;
  supplier_name: string;
  city_name: string;
  icao_code: string;
}

interface Props {
  client: Client;
  aircraft: Aircraft;
  onBack: () => void;
}

/**
 * Converte um objeto de erro do Supabase para uma mensagem de string legível
 */
const getErrorMessage = (error: any): string => {
  if (!error) return "Erro desconhecido";

  // Se é uma string, retorna diretamente
  if (typeof error === "string") return error;

  // Tenta extrair mensagem dos campos conhecidos do erro do Supabase
  if (error.message && typeof error.message === "string") return error.message;
  if (error.hint && typeof error.hint === "string") return error.hint;
  if (error.details && typeof error.details === "string") return error.details;

  // Se details é um objeto, tenta converter
  if (error.details && typeof error.details === "object") {
    try {
      return JSON.stringify(error.details);
    } catch {
      return "Erro nos detalhes da resposta";
    }
  }

  // Último recurso: converte para string
  try {
    return String(error);
  } catch {
    return "Erro ao processar";
  }
};

/**
 * Format date avoiding timezone shifts for Brazil (UTC-3)
 * Handles both ISO timestamps and date-only strings
 */
const formatDateBrazil = (dateValue: string | Date, formatStr: string = "dd/MM/yyyy"): string => {
  let dateObj: Date;

  if (typeof dateValue === 'string') {
    // If it's a date-only string (YYYY-MM-DD), parse it directly without timezone conversion
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateValue.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    } else {
      // If it's an ISO timestamp, extract the date part
      const datePart = dateValue.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    }
  } else {
    dateObj = dateValue;
  }

  return format(dateObj, formatStr);
};

export function FuelRecordsByAircraft({ client, aircraft, onBack }: Props) {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    data: "",
    trecho: "",
    local: "",
    comanda: "",
    litros: "",
    valor_unitario: "",
    abastecimento_galoes: "",
    ano: new Date().getFullYear().toString(),
    abastecedor_id: "",
    status_pagamento: "em aberto",
    comanda_file: null as File | null,
    nota_file: null as File | null,
    boleto_file: null as File | null,
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState({
    comanda_url: "",
    nota_url: "",
    boleto_url: "",
  });
  const [viewingAttachment, setViewingAttachment] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRecords();
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft.id]);

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("fuel_suppliers")
        .select("id, supplier_name, city_name, icao_code")
        .order("supplier_name", { ascending: true });

      if (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(`Erro ao carregar fornecedores: ${errorMessage}`);
        console.error("Error loading suppliers:", error);
        return;
      }

      const uniqueSuppliers = Array.from(new Map((data || []).map((s: any) => [s.id, s])).values()) as FuelSupplier[];
      setSuppliers(uniqueSuppliers);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro ao carregar fornecedores: ${errorMessage}`);
      console.error("Exception loading suppliers:", err);
    }
  };

  const loadRecords = async () => {
    const { data, error } = await supabase
      .from("abastecimentos")
      .select("*")
      .eq("aeronave_id", aircraft.id)
      .eq("client_id", client.id)
      .order("data", { ascending: false });

    if (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Erro ao carregar: ${errorMessage}`);
      console.error("Load error:", error);
      return;
    }

    setRecords(data || []);
  };

  const uploadFile = async (file: File | null, fieldName: string): Promise<string | null> => {
    if (!file) return null;

    try {
      const timestamp = Date.now();
      const fileName = `${client.id}/${aircraft.id}/${timestamp}-${fieldName}-${file.name}`;

      const { error } = await supabase.storage
        .from("abastecimento")
        .upload(fileName, file);

      if (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(`Upload falhou - ${fieldName}: ${errorMessage}`);
        console.error(`Upload error for ${fieldName}:`, error);
        return null;
      }

      const { data } = supabase.storage
        .from("abastecimento")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro de upload - ${fieldName}: ${errorMessage}`);
      console.error(`Upload exception for ${fieldName}:`, err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar se comanda está preenchida
    if (!formData.comanda.trim() && !editingRecord) {
      setShowConfirmation(true);
      return;
    }

    await saveRecord();
  };

  const saveRecord = async () => {
    setIsUploading(true);
    setShowConfirmation(false);

    try {
      // Validar campos obrigatórios
      if (!formData.data || !formData.data.trim()) {
        toast.error("Campo obrigatório: Data não pode estar vazia");
        setIsUploading(false);
        return;
      }

      if (!formData.litros || formData.litros.trim() === "") {
        toast.error("Campo obrigatório: Litros deve ser preenchido");
        setIsUploading(false);
        return;
      }

      if (!formData.valor_unitario || formData.valor_unitario.trim() === "") {
        toast.error("Campo obrigatório: Valor unitário deve ser preenchido");
        setIsUploading(false);
        return;
      }

      const litros = parseFloat(formData.litros);
      const valorUnitario = parseFloat(formData.valor_unitario);

      if (isNaN(litros) || litros <= 0) {
        toast.error("Valor inválido: Litros deve ser um número maior que zero");
        setIsUploading(false);
        return;
      }

      if (isNaN(valorUnitario) || valorUnitario < 0) {
        toast.error("Valor inválido: Valor unitário deve ser um número não negativo");
        setIsUploading(false);
        return;
      }

      const valorTotal = litros * valorUnitario;

      // Fazer upload dos arquivos
      let comandaUrl = uploadedFiles.comanda_url;
      let notaUrl = uploadedFiles.nota_url;
      let boletoUrl = uploadedFiles.boleto_url;

      if (formData.comanda_file && !comandaUrl) {
        comandaUrl = await uploadFile(formData.comanda_file, "comanda") || "";
      }
      if (formData.nota_file && !notaUrl) {
        notaUrl = await uploadFile(formData.nota_file, "nota-fiscal") || "";
      }
      if (formData.boleto_file && !boletoUrl) {
        boletoUrl = await uploadFile(formData.boleto_file, "boleto") || "";
      }

      // Convert date string to proper ISO format for Brazil timezone (UTC-3)
      // The date input gives us YYYY-MM-DD format
      // We need to convert this to the start of that day in Brazil time (UTC-3)
      // which is 03:00:00 UTC (so it doesn't shift backward by timezone conversion)
      const dateStr = formData.data; // e.g., "2024-12-19"
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const day = parseInt(dateParts[2], 10);

      // Create a date at midnight Brazil time
      // Brazil is UTC-3, so midnight in Brazil = 03:00 UTC
      const brazilDate = new Date(year, month - 1, day, 3, 0, 0, 0);
      const isoDateString = brazilDate.toISOString(); // This will be in UTC

      const supplierName = formData.abastecedor_id
        ? suppliers.find(s => s.id === formData.abastecedor_id)?.supplier_name || null
        : null;

      const recordData = {
        client_id: client.id,
        aeronave_id: aircraft.id,
        data: isoDateString, // Store as ISO string to preserve the correct date
        trecho: formData.trecho || null,
        local: formData.local || null,
        comanda: formData.comanda || null,
        litros: litros,
        valor_unitario: valorUnitario,
        abastecimento_galoes: formData.abastecimento_galoes ? parseFloat(formData.abastecimento_galoes) : null,
        ano: null,
        abastecedor: supplierName,
        status_pagamento: formData.status_pagamento || "em aberto",
        comanda_url: comandaUrl || null,
        nota_url: notaUrl || null,
        boleto_url: boletoUrl || null,
      };

      if (editingRecord) {
        const { error } = await supabase.from("abastecimentos").update(recordData).eq("id", editingRecord.id);

        if (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(`Erro ao atualizar: ${errorMessage}`);
          console.error("Update error:", error);
          return;
        }
        toast.success("Registro atualizado com sucesso");
      } else {
        const { error } = await supabase.from("abastecimentos").insert(recordData);

        if (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(`Erro ao salvar: ${errorMessage}`);
          console.error("Insert error:", error);
          return;
        }
        toast.success("Registro criado com sucesso");
      }

      resetForm();
      setIsDialogOpen(false);
      loadRecords();
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      toast.error(`Erro: ${errorMessage}`);
      console.error("Save error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (record: FuelRecord) => {
    const supplierRecord = suppliers.find(s => s.supplier_name === record.abastecedor);
    setEditingRecord(record);
    setFormData({
      data: record.data,
      trecho: record.trecho || "",
      local: record.local || "",
      comanda: record.comanda,
      litros: record.litros.toString(),
      valor_unitario: record.valor_unitario.toString(),
      abastecimento_galoes: record.abastecimento_galoes?.toString() || "",
      ano: new Date().getFullYear().toString(),
      abastecedor_id: supplierRecord?.id || "",
      status_pagamento: record.status_pagamento || "em aberto",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
    });
    setUploadedFiles({
      comanda_url: record.comanda_url || "",
      nota_url: record.nota_url || "",
      boleto_url: record.boleto_url || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro?")) return;

    const { error } = await supabase.from("abastecimentos").delete().eq("id", id);

    if (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Erro ao excluir: ${errorMessage}`);
      console.error("Delete error:", error);
      return;
    }

    toast.success("Registro excluído com sucesso");
    loadRecords();
  };

  const resetForm = () => {
    setFormData({
      data: "",
      trecho: "",
      local: "",
      comanda: "",
      litros: "",
      valor_unitario: "",
      abastecimento_galoes: "",
      ano: new Date().getFullYear().toString(),
      abastecedor_id: "",
      status_pagamento: "em aberto",
      comanda_file: null,
      nota_file: null,
      boleto_file: null,
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
    });
    setUploadedFiles({
      comanda_url: "",
      nota_url: "",
      boleto_url: "",
    });
    setEditingRecord(null);
  };

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = printRef.current?.innerHTML || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Controle de Abastecimento - ${client.company_name} - ${aircraft.registration}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .logo { max-width: 150px; }
            .title { text-align: center; flex: 1; }
            .title h1 { margin: 0; font-size: 24px; }
            .title p { margin: 5px 0; color: #666; }
            .year { text-align: right; font-size: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .text-right { text-align: right; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const currentYear = formData.ano || new Date().getFullYear().toString();

  const totalRecords = records.length;
  const totalLitros = records.reduce((sum, r) => sum + r.litros, 0);
  const totalValue = records.reduce((sum, r) => sum + r.valor_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Registros de Abastecimento
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{client.company_name} • {aircraft.registration}</p>
        </div>
      </div>

      {totalRecords > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Registros</p>
                  <p className="text-3xl font-bold text-foreground">{totalRecords}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-gradient-to-br from-success/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Litros</p>
                  <p className="text-3xl font-bold text-foreground">{totalLitros.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">litros</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-gradient-to-br from-accent/5 via-transparent to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Gasto Total</p>
                  <p className="text-3xl font-bold text-foreground">R$ {totalValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">valor total</p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:via-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
              <Plus className="h-5 w-5" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent className="flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2 sm:pr-4 -mx-2 sm:-mx-4 px-2 sm:px-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Data</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Rota</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Trecho</Label>
                    <Input
                      value={formData.trecho}
                      onChange={(e) => setFormData({ ...formData, trecho: e.target.value })}
                      placeholder="SBSP X SBRJ"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Local</Label>
                    <Input
                      value={formData.local}
                      onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                      placeholder="CUIABA"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nº Comanda</Label>
                <Input
                  value={formData.comanda}
                  onChange={(e) => setFormData({ ...formData, comanda: e.target.value })}
                  placeholder="Número da comanda"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                  <Combobox
                    options={suppliers.map(s => ({
                      value: s.id,
                      label: `${s.supplier_name} (${s.city_name})`
                    }))}
                    value={formData.abastecedor_id}
                    onValueChange={(value) => setFormData({ ...formData, abastecedor_id: value })}
                    placeholder="Selecione um fornecedor"
                    searchPlaceholder="Buscar fornecedor..."
                    emptyText="Nenhum fornecedor encontrado"
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Status de Pagamento</Label>
                  <Select
                    value={formData.status_pagamento}
                    onValueChange={(value) => setFormData({ ...formData, status_pagamento: value })}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em aberto">Em Aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">Combustível</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Litros</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.litros}
                      onChange={(e) => setFormData({ ...formData, litros: e.target.value })}
                      required
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor Unit. (R$)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.valor_unitario}
                      onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                      required
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Galões</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.abastecimento_galoes}
                  onChange={(e) => setFormData({ ...formData, abastecimento_galoes: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              {formData.litros && formData.valor_unitario && (
                <div className="bg-gradient-to-r from-success/10 to-success/5 border border-success/20 p-2 rounded-lg">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold text-success">
                    R$ {(parseFloat(formData.litros) * parseFloat(formData.valor_unitario)).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-4 block">Anexos</Label>
                <div className="space-y-3">
                  <ModernFileUpload
                    label="Comanda"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(file) => {
                      setFormData({ ...formData, comanda_file: file });
                      if (!file) {
                        setUploadedFiles({ ...uploadedFiles, comanda_url: "" });
                      }
                    }}
                    currentFile={formData.comanda_file}
                    uploadedUrl={formData.comanda_url}
                    disabled={isUploading}
                    allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                  />

                  <ModernFileUpload
                    label="Nota Fiscal"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(file) => {
                      setFormData({ ...formData, nota_file: file });
                      if (!file) {
                        setUploadedFiles({ ...uploadedFiles, nota_url: "" });
                      }
                    }}
                    currentFile={formData.nota_file}
                    uploadedUrl={formData.nota_url}
                    disabled={isUploading}
                    allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                  />

                  <ModernFileUpload
                    label="Boleto"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={(file) => {
                      setFormData({ ...formData, boleto_file: file });
                      if (!file) {
                        setUploadedFiles({ ...uploadedFiles, boleto_url: "" });
                      }
                    }}
                    currentFile={formData.boleto_file}
                    uploadedUrl={formData.boleto_url}
                    disabled={isUploading}
                    allowedFormats={["PDF", "PNG", "JPG", "JPEG", "GIF", "WEBP"]}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t sticky bottom-0 bg-background -mx-4 sm:-mx-0 px-4 sm:px-0 py-4 sm:py-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isUploading}
                  className="w-full sm:w-auto hover:bg-muted transition-colors"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto"
                  disabled={isUploading}
                >
                  {isUploading ? "Salvando..." : (editingRecord ? "Atualizar" : "Criar")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Comanda não preenchida</AlertDialogTitle>
              <AlertDialogDescription>
                Você está criando um registro sem informar a comanda. Embora não seja obrigatório, é importante ter esse dado para rastreamento. Deseja continuar mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Voltar e Preencher</AlertDialogCancel>
              <AlertDialogAction onClick={saveRecord}>
                Continuar sem Comanda
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          onClick={handleExportPDF}
          className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Download className="h-5 w-5" />
          Exportar PDF
        </Button>
      </div>

      <div style={{ display: "none" }}>
        <div ref={printRef}>
          <div className="header">
            <img src="/placeholder.svg" alt="Logo" className="logo" />
            <div className="title">
              <h1>CONTROLE DE COMBUSTÍVEL</h1>
              <p>{client.company_name}</p>
              <p>{aircraft.registration}</p>
            </div>
            <div className="year">{currentYear.slice(-2)}/{(parseInt(currentYear) + 1).toString().slice(-2)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>TRECHOS</th>
                <th>LOCAL ABAST</th>
                <th>COMANDI</th>
                <th className="text-right">ABAST. LITR</th>
                <th className="text-right">VALOR LITR</th>
                <th className="text-right">VALOR TOTAL</th>
                <th className="text-right">ABASTECIMENTO GALÕES</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDateBrazil(record.data, "dd/MM/yyyy")}</td>
                  <td>{record.trecho || "-"}</td>
                  <td>{record.local || "-"}</td>
                  <td>{record.comanda}</td>
                  <td className="text-right">{record.litros.toFixed(2)}</td>
                  <td className="text-right">R$ {record.valor_unitario.toFixed(5)}</td>
                  <td className="text-right">R$ {record.valor_total.toFixed(2)}</td>
                  <td className="text-right">{record.abastecimento_galoes?.toFixed(2) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="border border-border/50 shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-b border-border/50 hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">Data</TableHead>
                  <TableHead className="font-semibold text-foreground">Trecho</TableHead>
                  <TableHead className="font-semibold text-foreground">Local</TableHead>
                  <TableHead className="font-semibold text-foreground">Comanda</TableHead>
                  <TableHead className="font-semibold text-foreground">Fornecedor</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Litros</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Valor Unit.</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Valor Total</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Galões</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Anexos</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium text-foreground">
                      {formatDateBrazil(record.data, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.trecho || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{record.local || "-"}</TableCell>
                    <TableCell className="font-mono text-foreground">{record.comanda}</TableCell>
                    <TableCell className="text-muted-foreground">{record.abastecedor || "-"}</TableCell>
                    <TableCell>
                      {record.status_pagamento === "pago" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                          <FileCheck className="h-4 w-4" />
                          Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                          <DollarSign className="h-4 w-4" />
                          Em Aberto
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {record.litros.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      R$ {record.valor_unitario.toFixed(5)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      R$ {record.valor_total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {record.abastecimento_galoes?.toFixed(2) || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {record.comanda_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingAttachment({
                              url: record.comanda_url!,
                              type: record.comanda_url?.endsWith('.pdf') ? 'pdf' : 'image',
                              name: 'Comanda'
                            })}
                            className="h-7 px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 font-semibold text-xs gap-1"
                            title="Visualizar Comanda"
                          >
                            <FileText className="h-4 w-4" />
                            Comanda
                          </Button>
                        )}
                        {record.nota_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingAttachment({
                              url: record.nota_url!,
                              type: record.nota_url?.endsWith('.pdf') ? 'pdf' : 'image',
                              name: 'Nota Fiscal'
                            })}
                            className="h-7 px-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 font-semibold text-xs gap-1"
                            title="Visualizar Nota Fiscal"
                          >
                            <FileCheck className="h-4 w-4" />
                            NF
                          </Button>
                        )}
                        {record.boleto_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingAttachment({
                              url: record.boleto_url!,
                              type: record.boleto_url?.endsWith('.pdf') ? 'pdf' : 'image',
                              name: 'Boleto'
                            })}
                            className="h-7 px-2 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 font-semibold text-xs gap-1"
                            title="Visualizar Boleto"
                          >
                            <DollarSign className="h-4 w-4" />
                            Boleto
                          </Button>
                        )}
                        {!record.comanda_url && !record.nota_url && !record.boleto_url && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(record)}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {records.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">Nenhum registro de abastecimento</p>
                <p className="text-sm mt-1">Comece criando um novo registro</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {viewingAttachment && (
        <Dialog open={!!viewingAttachment} onOpenChange={(open) => !open && setViewingAttachment(null)}>
          <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-2">
                {viewingAttachment.name === 'Comanda' && <FileText className="h-5 w-5 text-blue-600" />}
                {viewingAttachment.name === 'Nota Fiscal' && <FileCheck className="h-5 w-5 text-green-600" />}
                {viewingAttachment.name === 'Boleto' && <DollarSign className="h-5 w-5 text-orange-600" />}
                Visualizando: {viewingAttachment.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg p-6">
              {viewingAttachment.type === 'pdf' ? (
                <div className="flex flex-col items-center justify-center gap-6 w-full">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="h-20 w-20 text-primary/40" />
                    <p className="text-lg font-semibold text-foreground">Arquivo PDF</p>
                    <p className="text-sm text-muted-foreground">Para visualizar o PDF completo, abra em uma nova aba</p>
                  </div>
                  <Button
                    onClick={() => window.open(viewingAttachment.url, '_blank')}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    Abrir em Nova Aba
                  </Button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center gap-4">
                  <img
                    src={viewingAttachment.url}
                    alt={viewingAttachment.name}
                    className="max-w-full max-h-[600px] object-contain rounded-lg shadow-lg"
                  />
                  <p className="text-xs text-muted-foreground">Clique para fechar</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
